"""
Import MTG game history from a TSV file into the tracker API.

Usage:
    python import_csv.py <path_to_tsv> <admin_key>

The TSV file should have columns: Player, Deck, Date Played, Won (Y/N), Game Number
"""

import sys
import csv
import requests
from datetime import datetime
from collections import defaultdict

BASE = "https://mtg-tracker-backend.azurewebsites.net"

def api(method, path, admin_key, **kwargs):
    res = requests.request(
        method,
        BASE + path,
        headers={"Content-Type": "application/json", "x-admin-key": admin_key},
        **kwargs
    )
    if not res.ok:
        raise Exception(f"{method} {path} failed: {res.status_code} {res.text}")
    return res.json()


def run(tsv_path, admin_key):
    # --- Parse TSV ---
    rows = []
    with open(tsv_path, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        for line in reader:
            if not line or not line[0].strip():
                continue
            # Strip all fields
            line = [c.strip() for c in line]
            # Skip header rows
            if line[0].lower() in ("player", ""):
                continue
            if len(line) < 5:
                print(f"  SKIP short row: {line}")
                continue
            player, deck, date_str, won_str, game_num_str = line[0], line[1], line[2], line[3], line[4]
            if not player or not deck:
                print(f"  SKIP row missing player or deck: {line}")
                continue
            try:
                game_num = int(game_num_str)
            except ValueError:
                print(f"  SKIP bad game number: {line}")
                continue
            try:
                date = datetime.strptime(date_str, "%d/%m/%Y").date()
            except ValueError:
                print(f"  SKIP bad date: {line}")
                continue
            won = won_str.strip().lower() == "yes" or won_str.strip() == "Y"
            rows.append({
                "player": player,
                "deck": deck,
                "date": date,
                "won": won,
                "game_num": game_num,
            })

    print(f"Parsed {len(rows)} valid rows.")

    # --- Group by game number ---
    games = defaultdict(list)
    for row in rows:
        games[row["game_num"]].append(row)

    # --- Validate games ---
    valid_games = {}
    draw_games = []
    for gnum, grows in sorted(games.items()):
        winners = [r for r in grows if r["won"]]
        if len(winners) != 1:
            print(f"  DRAW game {gnum}: {len(winners)} winners — importing as draw")
            draw_games.append(gnum)
        valid_games[gnum] = grows

    print(f"\n{len(valid_games)} games total, {len(draw_games)} marked as draws: {draw_games}")

    # --- Collect unique players ---
    all_players = sorted(set(r["player"] for grows in valid_games.values() for r in grows))
    print(f"\nPlayers ({len(all_players)}): {all_players}")

    # --- Create players ---
    print("\nCreating players...")
    existing_players = {p["name"]: p["id"] for p in api("GET", "/players", admin_key)}
    player_ids = dict(existing_players)
    for name in all_players:
        if name not in player_ids:
            try:
                p = api("POST", "/players", admin_key, json={"name": name})
                player_ids[name] = p["id"]
                print(f"  Created player: {name}")
            except Exception as e:
                print(f"  ERROR creating player {name}: {e}")

    # --- Collect unique (player, deck) pairs ---
    deck_pairs = sorted(set((r["player"], r["deck"]) for grows in valid_games.values() for r in grows))
    print(f"\nDecks ({len(deck_pairs)}):")

    # --- Create decks ---
    existing_decks_raw = api("GET", "/decks", admin_key)
    # deck_ids: (player_name, deck_name) -> deck_id
    deck_ids = {}
    for d in existing_decks_raw:
        deck_ids[(d["player"]["name"], d["name"])] = d["id"]

    for player_name, deck_name in deck_pairs:
        if (player_name, deck_name) in deck_ids:
            continue
        if player_name not in player_ids:
            print(f"  SKIP deck {deck_name} — player {player_name} not found")
            continue
        try:
            d = api("POST", "/decks", admin_key, json={"name": deck_name, "player_id": player_ids[player_name]})
            deck_ids[(player_name, deck_name)] = d["id"]
            print(f"  Created deck: {deck_name} ({player_name})")
        except Exception as e:
            print(f"  ERROR creating deck {deck_name} ({player_name}): {e}")

    # --- Import games ---
    print(f"\nImporting {len(valid_games)} games...")
    imported = 0
    errors = 0
    for gnum in sorted(valid_games.keys()):
        grows = valid_games[gnum]
        date = grows[0]["date"].isoformat()
        results = []
        skip_game = False
        for r in grows:
            key = (r["player"], r["deck"])
            if key not in deck_ids:
                print(f"  SKIP game {gnum}: deck not found for {r['player']} / {r['deck']}")
                skip_game = True
                break
            results.append({"deck_id": deck_ids[key], "won": r["won"]})
        if skip_game:
            errors += 1
            continue
        is_draw = gnum in draw_games
        try:
            api("POST", "/admin/games", admin_key, json={"date": date, "notes": None, "draw": is_draw, "results": results})
            imported += 1
            if imported % 50 == 0:
                print(f"  ... {imported} games imported")
        except Exception as e:
            print(f"  ERROR importing game {gnum}: {e}")
            errors += 1

    print(f"\nDone! {imported} games imported ({len(draw_games)} draws), {errors} errors.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python import_csv.py <path_to_tsv> <admin_key>")
        sys.exit(1)
    run(sys.argv[1], sys.argv[2])
