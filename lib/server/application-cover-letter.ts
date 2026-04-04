const MOTIVATION_REFERENCE_REGEX =
  /\[motivation_letter_file\]\s*(company\/[^\s]+)/i;
const MOTIVATION_PATH_FALLBACK_REGEX =
  /(company\/[^\s]*motivation-letter[^\s]*)/i;

export type ParsedCoverLetter = {
  coverLetterText: string | null;
  motivationLetterPath: string | null;
};

function normalizeStoragePath(path: string): string {
  return path.trim().replace(/[\])>,.;]+$/g, "");
}

export function parseCoverLetterContent(coverLetter: string | null): ParsedCoverLetter {
  if (!coverLetter) {
    return {
      coverLetterText: null,
      motivationLetterPath: null,
    };
  }

  const normalized = coverLetter.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return {
      coverLetterText: null,
      motivationLetterPath: null,
    };
  }

  let coverLetterText = normalized;
  let motivationLetterPath: string | null = null;

  const referenceMatch = normalized.match(MOTIVATION_REFERENCE_REGEX);
  if (referenceMatch?.[1]) {
    motivationLetterPath = normalizeStoragePath(referenceMatch[1]);
    coverLetterText = normalized.replace(referenceMatch[0], "").trim();
  } else {
    const fallbackMatch = normalized.match(MOTIVATION_PATH_FALLBACK_REGEX);
    if (fallbackMatch?.[1]) {
      motivationLetterPath = normalizeStoragePath(fallbackMatch[1]);
      coverLetterText = normalized.replace(fallbackMatch[1], "").trim();
      coverLetterText = coverLetterText.replace(/\[motivation_letter_file\]/gi, "").trim();
    }
  }

  coverLetterText = coverLetterText.replace(/\n{3,}/g, "\n\n").trim();

  return {
    coverLetterText: coverLetterText || null,
    motivationLetterPath,
  };
}
