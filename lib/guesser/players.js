// Server-only player/person access. Re-exports the person-first registry.

export {
  getAllRows,
  getPerson,
  getCompareRow,
  getPersonsInMode,
  getAnswerPersons,
  getPool,
  getShippableModes,
  getGuessSuggestions,
  filterSuggestionList,
  resolveSubmission,
  resolvePersonById,
  getAnswerPayload,
} from "./registry";
