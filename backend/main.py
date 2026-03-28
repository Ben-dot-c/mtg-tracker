import os
import json
import secrets
from collections import defaultdict
from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date, datetime
from typing import List, Optional

# ---------- Key storage ----------

MASTER_KEY = os.environ.get("MASTER_KEY") or os.environ.get("ADMIN_KEY", "mtg-admin")
MASTER_NAME = "Ben"

KEYS_FILE = os.environ.get("ADMIN_KEYS_FILE", os.path.join(os.path.dirname(__file__), "admin_keys.json"))

def load_keys() -> dict:
    if not os.path.exists(KEYS_FILE):
        return {}
    try:
        with open(KEYS_FILE) as f:
            return json.load(f)
    except Exception:
        return {}

def save_keys(keys: dict):
    with open(KEYS_FILE, "w") as f:
        json.dump(keys, f, indent=2)


# ---------- Auth ----------

class AdminUser:
    def __init__(self, name: str, is_master: bool, token: str):
        self.name = name
        self.is_master = is_master
        self.token = token

def get_admin_user(x_admin_key: str = Header(None)) -> AdminUser:
    if not x_admin_key:
        raise HTTPException(status_code=401, detail="Admin key required")
    if x_admin_key == MASTER_KEY:
        return AdminUser(name=MASTER_NAME, is_master=True, token=x_admin_key)
    keys = load_keys()
    if x_admin_key in keys:
        return AdminUser(name=keys[x_admin_key], is_master=False, token=x_admin_key)
    raise HTTPException(status_code=401, detail="Invalid admin key")

def require_master(admin: AdminUser = Depends(get_admin_user)) -> AdminUser:
    if not admin.is_master:
        raise HTTPException(status_code=403, detail="Master key required")
    return admin


# ---------- App setup ----------

import models
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://nice-dune-06a4aa00f.1.azurestaticapps.net",
        "https://nice-dune-06a4aa00f-preview.eastus2.1.azurestaticapps.net",
        "http://localhost:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Logging ----------

def log_action(db: Session, admin: AdminUser, action: str, request: Request = None):
    ip = None
    if request:
        forwarded = request.headers.get("x-forwarded-for")
        ip = forwarded.split(",")[0].strip() if forwarded else request.client.host
    db.add(models.AdminLog(
        key_name=admin.name,
        action=action,
        timestamp=datetime.utcnow(),
        ip_address=ip,
    ))
    db.commit()


# ---------- Schemas ----------

class PlayerCreate(BaseModel):
    name: str

class PlayerOut(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class DeckCreate(BaseModel):
    name: str
    player_id: int

class DeckOut(BaseModel):
    id: int
    name: str
    player: PlayerOut
    model_config = {"from_attributes": True}


class GameResultIn(BaseModel):
    deck_id: int
    won: bool

class GameCreate(BaseModel):
    date: date
    notes: Optional[str] = None
    draw: bool = False
    results: List[GameResultIn]

class GameResultOut(BaseModel):
    deck: DeckOut
    won: bool
    model_config = {"from_attributes": True}

class GameOut(BaseModel):
    id: int
    date: date
    notes: Optional[str]
    draw: bool
    results: List[GameResultOut]
    model_config = {"from_attributes": True}


# ---------- Players ----------

@app.get("/players", response_model=List[PlayerOut])
def get_players(db: Session = Depends(get_db)):
    return db.query(models.Player).order_by(models.Player.name).all()

@app.post("/players", response_model=PlayerOut)
def create_player(player: PlayerCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Player).filter(models.Player.name == player.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Player already exists")
    new_player = models.Player(name=player.name)
    db.add(new_player)
    db.commit()
    db.refresh(new_player)
    return new_player


# ---------- Decks ----------

@app.get("/decks")
def get_decks(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Deck, func.count(models.GameResult.id).label("games"))
        .outerjoin(models.GameResult, models.GameResult.deck_id == models.Deck.id)
        .group_by(models.Deck.id)
        .order_by(models.Deck.name)
        .all()
    )
    return [
        {
            "id": deck.id,
            "name": deck.name,
            "player": {"id": deck.player.id, "name": deck.player.name},
            "games": games,
        }
        for deck, games in rows
    ]

@app.post("/decks", response_model=DeckOut)
def create_deck(deck: DeckCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Deck).filter(models.Deck.name == deck.name, models.Deck.player_id == deck.player_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Deck already exists for this player")
    player = db.query(models.Player).filter(models.Player.id == deck.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    new_deck = models.Deck(name=deck.name, player_id=deck.player_id)
    db.add(new_deck)
    db.commit()
    db.refresh(new_deck)
    return new_deck


# ---------- Games ----------

@app.get("/games", response_model=List[GameOut])
def get_games(db: Session = Depends(get_db)):
    return db.query(models.Game).order_by(models.Game.date.desc()).all()

@app.post("/games", response_model=GameOut)
def create_game(game: GameCreate, db: Session = Depends(get_db)):
    winners = [r for r in game.results if r.won]
    if not game.draw and len(winners) != 1:
        raise HTTPException(status_code=400, detail="Exactly one player must be marked as winner")
    results = game.results if not game.draw else [GameResultIn(deck_id=r.deck_id, won=False) for r in game.results]
    new_game = models.Game(date=game.date, notes=game.notes, draw=game.draw)
    db.add(new_game)
    db.flush()
    for result in results:
        db.add(models.GameResult(game_id=new_game.id, deck_id=result.deck_id, won=result.won))
    db.commit()
    db.refresh(new_game)
    return new_game


# ---------- Stats ----------

@app.get("/stats/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    recent_game_ids = [
        g.id for g in db.query(models.Game.id)
        .order_by(models.Game.date.desc(), models.Game.id.desc())
        .limit(75)
        .all()
    ]
    players = db.query(models.Player).all()
    leaderboard = []
    for player in players:
        deck_ids = [d.id for d in player.decks]
        if not deck_ids:
            continue
        total = db.query(models.GameResult).filter(models.GameResult.deck_id.in_(deck_ids)).count()
        wins = db.query(models.GameResult).filter(
            models.GameResult.deck_id.in_(deck_ids),
            models.GameResult.won == True
        ).count()
        if total == 0:
            continue

        # Best deck (within last 75 games overall, min 3 appearances)
        best_deck = None
        best_deck_rate = 0
        for deck in player.decks:
            recent = (
                db.query(models.GameResult)
                .filter(models.GameResult.deck_id == deck.id)
                .filter(models.GameResult.game_id.in_(recent_game_ids))
                .all()
            )
            d_total = len(recent)
            if d_total < 3:
                continue
            d_wins = sum(1 for r in recent if r.won)
            rate = round(d_wins / d_total * 100, 1)
            if rate > best_deck_rate:
                best_deck_rate = rate
                best_deck = {"name": deck.name, "win_rate": rate, "games": d_total}

        # Streaks (excluding draws)
        streak_results = (
            db.query(models.GameResult, models.Game)
            .join(models.Game, models.GameResult.game_id == models.Game.id)
            .filter(models.GameResult.deck_id.in_(deck_ids))
            .filter(models.Game.draw == False)
            .order_by(models.Game.date, models.Game.id)
            .all()
        )
        streak = 0
        longest_streak = 0
        for result, game in streak_results:
            if result.won:
                streak += 1
                if streak > longest_streak:
                    longest_streak = streak
            else:
                streak = 0
        current_streak = streak

        leaderboard.append({
            "player": player.name,
            "wins": wins,
            "games": total,
            "win_rate": round(wins / total * 100, 1),
            "best_deck": best_deck,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
        })
    leaderboard.sort(key=lambda x: x["wins"], reverse=True)
    return leaderboard


@app.get("/stats/head-to-head")
def get_head_to_head(db: Session = Depends(get_db)):
    rows = (
        db.query(models.GameResult, models.Game, models.Player)
        .join(models.Game, models.GameResult.game_id == models.Game.id)
        .join(models.Deck, models.GameResult.deck_id == models.Deck.id)
        .join(models.Player, models.Deck.player_id == models.Player.id)
        .filter(models.Game.draw == False)
        .all()
    )
    games_data = defaultdict(dict)
    for result, game, player in rows:
        # If same player appears twice in a game, prefer the won=True entry
        if player.name not in games_data[game.id] or result.won:
            games_data[game.id][player.name] = result.won

    all_players = sorted(set(p for players in games_data.values() for p in players))
    matrix = {a: {b: 0 for b in all_players} for a in all_players}
    for in_game in games_data.values():
        winner = next((p for p, won in in_game.items() if won), None)
        if winner:
            for opponent in in_game:
                if opponent != winner:
                    matrix[winner][opponent] += 1
    return {"players": all_players, "matrix": matrix}


@app.get("/stats/deck-history")
def get_deck_history(db: Session = Depends(get_db)):
    rows = (
        db.query(models.GameResult, models.Game, models.Deck, models.Player)
        .join(models.Game, models.GameResult.game_id == models.Game.id)
        .join(models.Deck, models.GameResult.deck_id == models.Deck.id)
        .join(models.Player, models.Deck.player_id == models.Player.id)
        .order_by(models.Game.date, models.Game.id)
        .all()
    )
    deck_data = {}
    for result, game, deck, player in rows:
        if deck.id not in deck_data:
            deck_data[deck.id] = {
                "deck_id": deck.id,
                "deck_name": deck.name,
                "player": player.name,
                "deck_label": f"{deck.name} ({player.name})",
                "results": [],
            }
        deck_data[deck.id]["results"].append((result.won, game.draw))

    output = []
    for data in deck_data.values():
        wins = 0
        total = 0
        history = []
        for won, draw in data["results"]:
            if draw:
                continue
            total += 1
            if won:
                wins += 1
            history.append({
                "game_number": total,
                "cumulative_win_rate": round(wins / total * 100, 1),
            })
        output.append({
            "deck_id": data["deck_id"],
            "deck_name": data["deck_name"],
            "player": data["player"],
            "deck_label": data["deck_label"],
            "history": history,
        })
    return sorted(output, key=lambda d: d["deck_label"])


@app.get("/stats/deck/{deck_id}")
def get_deck_stats(deck_id: int, db: Session = Depends(get_db)):
    deck = db.query(models.Deck).filter(models.Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    results = (
        db.query(models.GameResult, models.Game)
        .join(models.Game, models.GameResult.game_id == models.Game.id)
        .filter(models.GameResult.deck_id == deck_id)
        .order_by(models.Game.date, models.Game.id)
        .all()
    )

    wins = 0
    losses = 0
    draws = 0
    non_draw_total = 0
    history = []
    game_ids_won = []
    game_ids_lost = []

    for result, game in results:
        if game.draw:
            draws += 1
        elif result.won:
            wins += 1
            game_ids_won.append(game.id)
        else:
            losses += 1
            game_ids_lost.append(game.id)

        if not game.draw:
            non_draw_total += 1
            history.append({
                "game_number": non_draw_total,
                "cumulative_win_rate": round(wins / non_draw_total * 100, 1),
            })

    win_rate = round(wins / (wins + losses) * 100, 1) if (wins + losses) > 0 else 0

    won_against: dict = defaultdict(int)
    if game_ids_won:
        for opp_result, opp_deck, opp_player in (
            db.query(models.GameResult, models.Deck, models.Player)
            .join(models.Deck, models.GameResult.deck_id == models.Deck.id)
            .join(models.Player, models.Deck.player_id == models.Player.id)
            .filter(
                models.GameResult.game_id.in_(game_ids_won),
                models.GameResult.deck_id != deck_id,
            )
            .all()
        ):
            won_against[(opp_deck.id, opp_deck.name, opp_player.name)] += 1

    lost_against: dict = defaultdict(int)
    if game_ids_lost:
        for win_result, win_deck, win_player in (
            db.query(models.GameResult, models.Deck, models.Player)
            .join(models.Deck, models.GameResult.deck_id == models.Deck.id)
            .join(models.Player, models.Deck.player_id == models.Player.id)
            .filter(
                models.GameResult.game_id.in_(game_ids_lost),
                models.GameResult.deck_id != deck_id,
                models.GameResult.won == True,
            )
            .all()
        ):
            lost_against[(win_deck.id, win_deck.name, win_player.name)] += 1

    most_won_against = sorted(
        [{"deck_id": k[0], "deck_name": k[1], "player": k[2], "count": v} for k, v in won_against.items()],
        key=lambda x: x["count"], reverse=True,
    )[:5]

    most_lost_against = sorted(
        [{"deck_id": k[0], "deck_name": k[1], "player": k[2], "count": v} for k, v in lost_against.items()],
        key=lambda x: x["count"], reverse=True,
    )[:5]

    return {
        "deck_id": deck.id,
        "deck_name": deck.name,
        "player": deck.player.name,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "games": wins + losses + draws,
        "win_rate": win_rate,
        "history": history,
        "most_won_against": most_won_against,
        "most_lost_against": most_lost_against,
    }


# ---------- Admin ----------

class ImportNames(BaseModel):
    names: List[str]

class ImportDecks(BaseModel):
    # Each entry: "DeckName,PlayerName"
    entries: List[str]

@app.get("/admin/whoami")
def whoami(admin: AdminUser = Depends(get_admin_user)):
    return {"name": admin.name, "is_master": admin.is_master}

@app.post("/admin/import/players")
def import_players(data: ImportNames, request: Request, db: Session = Depends(get_db), admin: AdminUser = Depends(get_admin_user)):
    added = 0
    skipped = 0
    for name in data.names:
        name = name.strip()
        if not name:
            continue
        existing = db.query(models.Player).filter(models.Player.name == name).first()
        if existing:
            skipped += 1
        else:
            db.add(models.Player(name=name))
            added += 1
    db.commit()
    log_action(db, admin, f"import players: {added} added, {skipped} skipped", request)
    return {"added": added, "skipped": skipped}

@app.post("/admin/import/decks")
def import_decks(data: ImportDecks, request: Request, db: Session = Depends(get_db), admin: AdminUser = Depends(get_admin_user)):
    added = 0
    skipped = 0
    errors = []
    for entry in data.entries:
        entry = entry.strip()
        if not entry:
            continue
        if "," not in entry:
            errors.append(f"Bad format (expected 'DeckName,PlayerName'): {entry}")
            continue
        deck_name, player_name = [x.strip() for x in entry.split(",", 1)]
        player = db.query(models.Player).filter(models.Player.name == player_name).first()
        if not player:
            errors.append(f"Player not found: {player_name}")
            continue
        existing = db.query(models.Deck).filter(models.Deck.name == deck_name, models.Deck.player_id == player.id).first()
        if existing:
            skipped += 1
        else:
            db.add(models.Deck(name=deck_name, player_id=player.id))
            added += 1
    db.commit()
    log_action(db, admin, f"import decks: {added} added, {skipped} skipped", request)
    return {"added": added, "skipped": skipped, "errors": errors}

@app.delete("/admin/players/{player_id}")
def delete_player(player_id: int, request: Request, db: Session = Depends(get_db), admin: AdminUser = Depends(get_admin_user)):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    name = player.name
    for deck in player.decks:
        db.query(models.GameResult).filter(models.GameResult.deck_id == deck.id).delete()
        db.delete(deck)
    db.delete(player)
    db.commit()
    log_action(db, admin, f"delete player: {name}", request)
    return {"ok": True}

@app.delete("/admin/decks/{deck_id}")
def delete_deck(deck_id: int, request: Request, db: Session = Depends(get_db), admin: AdminUser = Depends(get_admin_user)):
    deck = db.query(models.Deck).filter(models.Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    name = deck.name
    db.query(models.GameResult).filter(models.GameResult.deck_id == deck_id).delete()
    db.delete(deck)
    db.commit()
    log_action(db, admin, f"delete deck: {name}", request)
    return {"ok": True}

@app.delete("/admin/games/{game_id}")
def delete_game(game_id: int, request: Request, db: Session = Depends(get_db), admin: AdminUser = Depends(get_admin_user)):
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    date_str = str(game.date)
    db.query(models.GameResult).filter(models.GameResult.game_id == game_id).delete()
    db.delete(game)
    db.commit()
    log_action(db, admin, f"delete game: {date_str}", request)
    return {"ok": True}

@app.post("/admin/games")
def log_game(game: GameCreate, request: Request, db: Session = Depends(get_db), admin: AdminUser = Depends(get_admin_user)):
    winners = [r for r in game.results if r.won]
    if not game.draw and len(winners) != 1:
        raise HTTPException(status_code=400, detail="Exactly one player must be marked as winner")
    results = game.results if not game.draw else [GameResultIn(deck_id=r.deck_id, won=False) for r in game.results]
    new_game = models.Game(date=game.date, notes=game.notes, draw=game.draw)
    db.add(new_game)
    db.flush()
    for result in results:
        db.add(models.GameResult(game_id=new_game.id, deck_id=result.deck_id, won=result.won))
    db.commit()
    db.refresh(new_game)
    log_action(db, admin, f"log game: {game.date}", request)
    return new_game

@app.delete("/admin/clear-all")
def clear_all(request: Request, db: Session = Depends(get_db), admin: AdminUser = Depends(require_master)):
    db.query(models.GameResult).delete()
    db.query(models.Game).delete()
    db.query(models.Deck).delete()
    db.query(models.Player).delete()
    db.commit()
    log_action(db, admin, "clear all data", request)
    return {"ok": True}


# ---------- Master-only: logs & key management ----------

@app.get("/admin/logs")
def get_logs(db: Session = Depends(get_db), admin: AdminUser = Depends(require_master)):
    logs = db.query(models.AdminLog).order_by(models.AdminLog.timestamp.desc()).limit(200).all()
    return [
        {
            "id": l.id,
            "key_name": l.key_name,
            "action": l.action,
            "timestamp": l.timestamp.isoformat(),
            "ip_address": l.ip_address,
        }
        for l in logs
    ]

@app.get("/admin/keys")
def get_keys(admin: AdminUser = Depends(require_master)):
    keys = load_keys()
    return [{"token": token, "name": name} for token, name in keys.items()]

class KeyCreate(BaseModel):
    name: str

@app.post("/admin/keys")
def create_key(data: KeyCreate, admin: AdminUser = Depends(require_master)):
    keys = load_keys()
    token = secrets.token_urlsafe(16)
    keys[token] = data.name
    save_keys(keys)
    return {"token": token, "name": data.name}

@app.delete("/admin/keys/{token}")
def delete_key(token: str, admin: AdminUser = Depends(require_master)):
    keys = load_keys()
    if token not in keys:
        raise HTTPException(status_code=404, detail="Key not found")
    name = keys.pop(token)
    save_keys(keys)
    return {"ok": True, "name": name}
