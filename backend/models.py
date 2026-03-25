from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    decks = relationship("Deck", back_populates="player")


class Deck(Base):
    __tablename__ = "decks"
    __table_args__ = (UniqueConstraint('name', 'player_id'),)

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)

    player = relationship("Player", back_populates="decks")
    results = relationship("GameResult", back_populates="deck")


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    notes = Column(String, nullable=True)
    draw = Column(Boolean, default=False)

    results = relationship("GameResult", back_populates="game")


class GameResult(Base):
    __tablename__ = "game_results"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)
    deck_id = Column(Integer, ForeignKey("decks.id"), nullable=False)
    won = Column(Boolean, default=False)

    game = relationship("Game", back_populates="results")
    deck = relationship("Deck", back_populates="results")


class AdminLog(Base):
    __tablename__ = "admin_logs"

    id = Column(Integer, primary_key=True, index=True)
    key_name = Column(String, nullable=False)
    action = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, nullable=True)
