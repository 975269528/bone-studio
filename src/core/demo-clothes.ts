import type { DemoArtwork } from './demo-assets';

/** 衬衣包含脖颈、翻领与布褶；肩端隐藏在圆润袖根之下。 */
export const shirtArtwork: DemoArtwork = {
  id: 'asset-torso', name: '躯干 · 米白衬衣', width: 110, height: 128,
  content: `
    <path d="M45 2L63 2L64 19L73 24L54 41L36 25L44 17Z" fill="url(#skin)"/>
    <path d="M23 27Q33 22 41 20L51 27Q60 24 65 19L84 29Q96 38 95 65L90 105Q58 121 22 109L18 59Q14 38 23 27Z" fill="url(#linen)"/>
    <path d="M22 35Q19 53 25 64L28 103L37 109L32 57Z" fill="#cfc2cf" stroke="none" opacity=".65"/>
    <path d="M78 34Q88 43 88 65L85 88L80 88L78 54Z" fill="#fdfbf4" stroke="none"/>
    <path d="M40 19L35 29L45 39L53 29L48 26Z" fill="#fffdf6"/>
    <path d="M65 18L74 25Q69 32 59 37L53 29L59 25Z" fill="#eee6e6"/>
    <path d="M52 34L49 67M28 64L35 70M78 77L85 69M73 95L82 98" fill="none" stroke="#b7a9bb" stroke-width="2"/>
    <circle cx="52" cy="45" r="1.3" fill="#9a8597" stroke="none"/>
  `,
};

/** 围裙与衬衣分层，保留肩带、收腰、口袋、褶皱和浅色下摆。 */
export const apronArtwork: DemoArtwork = {
  id: 'asset-apron', name: '服装 · 紫围裙', width: 110, height: 140,
  content: `
    <path d="M30 26L34 25L30 51L72 53L79 28L84 30L78 79L87 128Q61 140 17 130L21 82L18 56L25 51Z" fill="url(#purple)"/>
    <path d="M77 34L83 31L78 79L87 128L72 132Q70 94 63 86L72 61Z" fill="#726a9e" stroke="none" opacity=".76"/>
    <path d="M29 53L69 55L66 75L25 75L22 59Z" fill="#a69ac8" stroke="none"/>
    <path d="M22 77Q48 81 77 77L77 86Q44 91 20 85Z" fill="#998bbb"/>
    <path d="M27 82Q44 84 56 82" fill="none" stroke="#beafd4" stroke-width="2.5"/>
    <path d="M51 87Q55 103 68 112M33 90L29 122M61 65L67 72" fill="none" stroke="#776c9f" stroke-width="2.4"/>
    <path d="M39 96Q48 98 58 96L58 107Q48 112 39 106Z" fill="#9e92be" stroke="#81749e" stroke-width="1.3"/>
    <path d="M20 127Q48 135 83 127L84 131Q56 141 18 133Z" fill="#e1d9ed" stroke="none"/>
    <path d="M23 58L27 71M22 94L20 123" fill="none" stroke="#c4b5da" stroke-width="2"/>
  `,
};
