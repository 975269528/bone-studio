export const MAX_ROTATION = 360_000;
const FULL_TURN = 360;

/** 选取最接近原局部角度的合法等价角度，保留圈数并避免补偿越界。 */
export function nearestRotation(angle: number, reference: number): number {
  const turns = Math.round((reference - angle) / FULL_TURN);
  const nearest = angle + turns * FULL_TURN;
  if (nearest > MAX_ROTATION) return nearest - FULL_TURN;
  if (nearest < -MAX_ROTATION) return nearest + FULL_TURN;
  return nearest;
}
