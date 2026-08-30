// Cards
export { RANKS, SUITS, cardToString, parseCard, rankValue } from './cards/card.js';
export type { Card, Rank, Suit } from './cards/card.js';
export { createDeck, shuffleDeck, dealCards, burnAndDeal } from './cards/deck.js';

// Evaluation
export {
  HandCategory,
  compareScores,
  evaluateBestHand,
  cardsToString,
} from './eval/hand-evaluator.js';
export type { HandScore, EvaluatedHand } from './eval/hand-evaluator.js';

// Pots & rake
export { calculateSidePots, totalPotAmount } from './pot/side-pot.js';
export type { PotSlice, PlayerBetState } from './pot/side-pot.js';
export {
  buildContestedSettlementView,
  buildUncontestedSettlementView,
  settlementPauseMs,
  uncalledExcess,
} from './pot/settlement-view.js';
export type {
  SettlementView,
  SettlementPotLine,
  SettlementRefund,
} from './pot/settlement-view.js';
export { calculateRake, OFFICIAL_RAKE_RATE, PRIVATE_RAKE_RATE } from './pot/rake.js';
export type { RakeInput, RakeResult } from './pot/rake.js';

// Game logic
export {
  getValidActions,
  applyAction,
  isBettingRoundComplete,
  playerNeedsAction,
  nextSeatNeedingAction,
  countActivePlayers,
  nextActiveSeat,
  nextSeatWithChips,
  createBettingRoundState,
  markBlindPosted,
  recordPlayerAction,
  resetBettingRound,
  actionWasRaise,
  classifyRaise,
  countActionablePlayers,
  countPlayersInHand,
  shouldRunoutBoard,
} from './game/actions.js';
export type { ActionType, ValidActions, BettingRoundState, RaiseClass } from './game/actions.js';
export {
  assignBlindSeats,
  firstToActSeat,
  seatsClockwiseFromLeftOfButton,
  dealOrderFromButton,
} from './game/blinds.js';
export type { BlindSeats, BettingStreet } from './game/blinds.js';
export { distributePotToWinners } from './game/settlement.js';
export type { PlayerState, TableConfig, SettlementResult, GamePhase } from './game/settlement.js';
export { phaseMachine, getNextPhase } from './game/state-machine.js';
export { HandRunner } from './game/hand-runner.js';
export type { HandResult, HandLogEntry } from './game/hand-runner.js';

// Bot
export { decideBotAction } from './bot/rule-bot.js';
export type { BotDecision, BotDecisionInput } from './bot/rule-bot.js';
