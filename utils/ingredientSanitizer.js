const LETTER_REGEX = /[A-Za-zÀ-ÖØ-öø-ÿ]/;
const NON_LETTER_EDGE_REGEX = /^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g;

const normalizeIngredientText = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
};

const extractIngredientNameCandidate = (line) => {
  const text = normalizeIngredientText(line);
  if (!text) return '';

  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?\s*(?:of\s+)?(.+)$/i);
  if (!match) return text;

  return normalizeIngredientText(match[3] || '');
};

const isValidIngredientName = (name, minLength = 2) => {
  const normalized = normalizeIngredientText(name);
  if (!normalized) return false;
  if (!LETTER_REGEX.test(normalized)) return false;

  const strippedEdges = normalized.replace(NON_LETTER_EDGE_REGEX, '').trim();
  if (!strippedEdges) return false;
  if (!LETTER_REGEX.test(strippedEdges)) return false;
  if (strippedEdges.length < minLength) return false;

  return true;
};

const isValidIngredientLine = (line, minLength = 2) => {
  const candidateName = extractIngredientNameCandidate(line);
  return isValidIngredientName(candidateName, minLength);
};

const sanitizeIngredientList = (ingredients, minLength = 2) => {
  if (!Array.isArray(ingredients)) return [];

  return ingredients
    .map((entry) => normalizeIngredientText(entry))
    .filter(Boolean)
    .filter((entry) => isValidIngredientLine(entry, minLength));
};

module.exports = {
  normalizeIngredientText,
  extractIngredientNameCandidate,
  isValidIngredientName,
  isValidIngredientLine,
  sanitizeIngredientList
};
