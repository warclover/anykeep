// Mock for franc-min ESM module
// Returns a simple language detection mock for Jest testing

const franc = (text) => {
  if (!text || text.length < 3) {
    return 'und'; // undetermined
  }

  // Simple heuristic for testing
  const chinesePattern = /[\u4e00-\u9fff]/;
  const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
  const koreanPattern = /[\uac00-\ud7af]/;

  if (chinesePattern.test(text)) {
    return 'cmn'; // Mandarin Chinese
  }
  if (japanesePattern.test(text)) {
    return 'jpn'; // Japanese
  }
  if (koreanPattern.test(text)) {
    return 'kor'; // Korean
  }

  return 'eng'; // Default to English
};

const francAll = (text) => {
  const result = franc(text);
  return [[result, 1]];
};

module.exports = { franc, francAll };
