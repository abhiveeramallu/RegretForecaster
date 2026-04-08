interface TopLevelParseResult {
  updates: Record<string, unknown>;
  completeObject: unknown | null;
}

const tryParseSegment = (segment: string): Record<string, unknown> | null => {
  const trimmed = segment.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(`{${trimmed}}`) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
};

export const parseTopLevelJsonProgress = (
  source: string,
  seenKeys: Set<string>
): TopLevelParseResult => {
  const updates: Record<string, unknown> = {};

  const objectStart = source.indexOf("{");
  if (objectStart === -1) {
    return { updates, completeObject: null };
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let topPairStart = -1;
  let completedAt = -1;

  const maybeCommitSegment = (segmentEnd: number) => {
    if (topPairStart === -1) return;

    const segment = source.slice(topPairStart, segmentEnd);
    const parsedSegment = tryParseSegment(segment);
    if (!parsedSegment) return;

    Object.entries(parsedSegment).forEach(([key, value]) => {
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      updates[key] = value;
    });
  };

  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;

      if (depth === 1 && topPairStart === -1) {
        topPairStart = index + 1;
      }

      continue;
    }

    if (char === "}" || char === "]") {
      const isTopLevelObjectClose = char === "}" && depth === 1;

      if (isTopLevelObjectClose) {
        maybeCommitSegment(index);
        completedAt = index;
      }

      depth -= 1;

      if (depth <= 0 && completedAt !== -1) {
        break;
      }

      continue;
    }

    if (char === "," && depth === 1) {
      maybeCommitSegment(index);
      topPairStart = index + 1;
    }
  }

  if (completedAt === -1) {
    return {
      updates,
      completeObject: null
    };
  }

  const completeSlice = source.slice(objectStart, completedAt + 1);
  try {
    const parsed = JSON.parse(completeSlice);
    return {
      updates,
      completeObject: parsed
    };
  } catch {
    return {
      updates,
      completeObject: null
    };
  }
};
