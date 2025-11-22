export const MIN_POINTS = 4;

const EPS = 1e-8;

const deepNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

function buildVandermonde(xs, order) {
  return xs.map((x) => {
    const row = [];
    for (let p = 0; p <= order; p += 1) {
      row.push(x ** p);
    }
    return row;
  });
}

function transpose(matrix) {
  return matrix[0].map((_, colIdx) => matrix.map((row) => row[colIdx]));
}

function multiply(A, B) {
  const result = Array.from({ length: A.length }, () =>
    Array(B[0].length).fill(0)
  );
  for (let i = 0; i < A.length; i += 1) {
    for (let k = 0; k < B.length; k += 1) {
      for (let j = 0; j < B[0].length; j += 1) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

function solveLinearSystem(A, b) {
  const n = A.length;
  const aug = A.map((row, idx) => [...row, b[idx]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(aug[pivot][col]) < EPS) continue;
    if (pivot !== col) {
      const tmp = aug[pivot];
      aug[pivot] = aug[col];
      aug[col] = tmp;
    }
    const pivotVal = aug[col][col];
    for (let j = col; j <= n; j += 1) {
      aug[col][j] /= pivotVal;
    }
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = col; j <= n; j += 1) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }
  return aug.map((row) => row[n]);
}

function polyfit(xs, ys, order) {
  if (xs.length === 0) return [];
  const actualOrder = Math.min(order, xs.length - 1);
  const V = buildVandermonde(xs, actualOrder);
  const VT = transpose(V);
  const ATA = multiply(VT, V);
  const ATy = multiply(VT, ys.map((y) => [y]));
  const coeffs = solveLinearSystem(ATA, ATy.map((row) => row[0]));
  return coeffs;
}

function polyval(coeffs, x) {
  return coeffs.reduce((sum, coeff, idx) => sum + coeff * x ** idx, 0);
}

export function ensureMinimumRows(rows, xKey, yKey, minPoints = MIN_POINTS) {
  if (!Array.isArray(rows)) return [];
  const cleaned = rows
    .map((row) => ({
      ...row,
      [xKey]: deepNumber(row[xKey]),
      [yKey]: deepNumber(row[yKey]),
    }))
    .filter(
      (row) =>
        row[xKey] !== null &&
        row[yKey] !== null &&
        Number.isFinite(row[xKey]) &&
        Number.isFinite(row[yKey])
    )
    .sort((a, b) => a[xKey] - b[xKey]);

  if (cleaned.length === 0) return [];
  if (cleaned.length >= minPoints) return cleaned;

  const xs = cleaned.map((row) => row[xKey]);
  const ys = cleaned.map((row) => row[yKey]);
  const coeffs = polyfit(xs, ys, 4);

  const result = [...cleaned];
  while (result.length < minPoints && xs.length >= 2) {
    let maxGap = -Infinity;
    let insertIdx = 0;
    for (let i = 0; i < xs.length - 1; i += 1) {
      const gap = xs[i + 1] - xs[i];
      if (gap > maxGap) {
        maxGap = gap;
        insertIdx = i;
      }
    }
    const midX = xs[insertIdx] + maxGap / 2;
    const midY = polyval(coeffs, midX);
    const newRow = {
      ...result[insertIdx],
      [xKey]: midX,
      [yKey]: midY,
    };
    result.splice(insertIdx + 1, 0, newRow);
    xs.splice(insertIdx + 1, 0, midX);
    ys.splice(insertIdx + 1, 0, midY);
  }

  return result;
}

export function flattenManualSteps(steps) {
  if (!Array.isArray(steps)) return [];
  const flattened = [];
  steps.forEach((step) => {
    const rate = deepNumber(step?.rate_gpm);
    if (!Array.isArray(step?.rows) || rate === null) return;
    step.rows.forEach((row) => {
      const time = deepNumber(row.time_min);
      const draw = deepNumber(row.drawdown_ft);
      if (time === null || draw === null) return;
      flattened.push({
        time_min: time,
        drawdown_ft: draw,
        rate_gpm: rate,
      });
    });
  });
  return flattened.sort((a, b) => a.time_min - b.time_min);
}
