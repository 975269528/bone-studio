import type { DemoArtwork } from './demo-assets';

function sleeve(isNear: boolean): DemoArtwork {
  return { id: `asset-upper-arm-${isNear ? 'right' : 'left'}`,
    name: `${isNear ? '近侧右' : '远侧左'}上臂 · 卷袖`, width: 63, height: 34,
    content: `<path d="M4 18Q3 7 13 5Q28 3 38 8L52 7Q61 12 59 21L55 28Q46 31 35 28L15 30Q6 28 4 18Z" fill="${isNear ? 'url(#linen)' : '#e4dbe0'}"/><path d="M19 8Q29 9 35 15M22 24L34 22" fill="none" stroke="#b9aabb" stroke-width="2"/><path d="M47 8Q44 18 48 29L55 28Q60 19 56 10Z" fill="#fffaf1"/><path d="M12 9Q15 7 22 8" stroke="#fffdf4" fill="none" stroke-width="2.5"/>` };
}

function forearm(isNear: boolean): DemoArtwork {
  return { id: `asset-lower-arm-${isNear ? 'right' : 'left'}`,
    name: `${isNear ? '近侧右' : '远侧左'}前臂 · 肤色`, width: 58, height: 25,
    content: `<path d="M5 5Q12 2 21 5L43 8L53 7Q58 12 54 18L43 18L18 21Q6 23 3 14Z" fill="${isNear ? 'url(#skin)' : '#eac6af'}"/><path d="M15 6L40 10" fill="none" stroke="#fff2dd" stroke-width="3"/><path d="M19 20Q34 17 44 17" stroke="#dfad96" stroke-width="1.4" fill="none"/>` };
}

function hand(isNear: boolean): DemoArtwork {
  const content = isNear
    ? '<path d="M8 24L5 16Q2 14 3 11Q5 8 8 12L10 14L10 5Q10 1 13 2L15 11L16 3Q18 0 20 3L20 11L22 5Q25 3 26 6L25 13Q28 8 30 11L28 23Q26 29 19 30L10 29Z" fill="url(#skin)"/><path d="M12 20Q18 18 23 20M15 11L16 15M20 11L20 15" fill="none" stroke="#d8a48e" stroke-width="1"/>'
    : '<path d="M8 4L21 4L24 15Q27 20 23 25L14 27Q8 26 8 21L5 20Q2 17 4 13L7 11Z" fill="#edcbb3"/><path d="M10 13L10 20M16 22L20 21" stroke="#d3a188" stroke-width="1.2" fill="none"/>';
  return { id: `asset-hand-${isNear ? 'right' : 'left'}`, name: `${isNear ? '近侧右' : '远侧左'}手掌`,
    width: 34, height: 32, content };
}

function trouser(isNear: boolean): DemoArtwork {
  return { id: `asset-thigh-${isNear ? 'right' : 'left'}`, name: `${isNear ? '近侧右' : '远侧左'}大腿 · 浅裤`,
    width: 61, height: 39,
    content: `<path d="M4 8Q10 2 24 3L49 4Q58 8 58 18L56 31Q40 38 22 35L8 32Z" fill="${isNear ? 'url(#linen)' : '#ded4dd'}"/><path d="M32 5Q29 15 35 27M9 14L17 29" fill="none" stroke="#bcadbd" stroke-width="2"/><path d="M49 9L51 26" stroke="#fffaf1" stroke-width="5"/><path d="M47 33L57 30" stroke="#c3b2c0" fill="none"/>` };
}

function lowerLeg(isNear: boolean): DemoArtwork {
  return { id: `asset-shin-${isNear ? 'right' : 'left'}`, name: `${isNear ? '近侧右' : '远侧左'}小腿`,
    width: 45, height: 25,
    content: `<path d="M3 4Q9 1 19 4L40 6L40 21L17 22Q4 22 3 17Z" fill="${isNear ? 'url(#skin)' : '#ebcab6'}"/><path d="M17 7L35 8" stroke="#fff4e2" stroke-width="4"/><path d="M35 21L41 20" stroke="#d6a792" fill="none"/>` };
}

function shoe(isNear: boolean): DemoArtwork {
  return { id: `asset-foot-${isNear ? 'right' : 'left'}`, name: `${isNear ? '近侧右' : '远侧左'}鞋 · 棕色布鞋`,
    width: 48, height: 26,
    content: `<path d="M18 5Q29 2 40 5L44 19Q40 25 8 23Q1 21 4 15Q7 9 18 5Z" fill="${isNear ? '#ad7f60' : '#967057'}"/><path d="M5 18Q24 22 43 17L44 22Q28 27 6 24Z" fill="#765143"/><path d="M9 14Q13 8 21 8M24 7L37 7" fill="none" stroke="#d9b999" stroke-width="2"/><path d="M18 5Q26 10 40 5" fill="none" stroke="#795647" stroke-width="1.5"/>` };
}

/** 近侧手掌展开，远侧手自然收拢；圆润关节留出重叠，避免动画裂缝。 */
export function createLimbAssets(): DemoArtwork[] {
  return [false, true].flatMap((isNear) => [sleeve(isNear), forearm(isNear), hand(isNear),
    trouser(isNear), lowerLeg(isNear), shoe(isNear)]);
}
