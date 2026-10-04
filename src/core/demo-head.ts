import type { DemoArtwork } from './demo-assets';

/** 轻微朝左的头部：脸、侧耳、鬓发与头巾随同一头骨移动。 */
export const headArtwork: DemoArtwork = {
  id: 'asset-head', name: '头部 · 紫头巾与侧脸', width: 176, height: 164,
  content: `
    <path d="M144 99Q159 90 171 102Q168 110 158 114L149 111Q157 124 151 130L140 127L139 105Z" fill="url(#purple)"/>
    <path d="M151 104Q159 106 165 103M146 111L149 122" fill="none" stroke="#73618e" stroke-width="2"/>
    <path d="M24 78Q37 66 111 78L136 93L139 129Q126 151 108 151L38 144Q20 132 23 106Z" fill="#7a6258"/>
    <path d="M25 84Q65 77 120 90L130 112Q145 106 148 122Q150 142 127 145L119 142Q106 157 75 160Q39 161 27 144Q18 132 20 109Z" fill="url(#skin)"/>
    <path d="M26 88Q61 82 116 94L120 103Q75 90 24 102Z" fill="#e8b69f" stroke="none" opacity=".64"/>
    <path d="M121 88L137 100L133 116L123 122L125 108L116 104L114 88Z" fill="#82675c"/>
    <path d="M129 127Q134 119 140 126Q142 131 136 135L132 136" fill="#eab29e" stroke="#c08c78" stroke-width="1.5"/>
    <path d="M24 89L17 90Q11 86 12 77L14 55Q18 46 22 46L23 29Q36 13 53 13L58 9L76 7Q110 9 124 17Q145 22 153 41L155 76Q155 91 145 106L138 108Q112 88 84 87Q49 82 24 89Z" fill="url(#purple)"/>
    <path d="M25 31Q37 19 55 19L63 13L76 12Q49 10 34 23L21 43L21 67L27 64L30 41Z" fill="#e4c8e6" stroke="none"/>
    <path d="M128 34Q142 42 148 54L148 78Q141 84 136 81L132 62L126 62Z" fill="#cbb0d8" stroke="none"/>
    <path d="M81 42Q85 39 93 41L94 47Q88 49 81 46Z" fill="#d7bbdf" stroke="none"/>
    <path d="M17 73Q31 60 56 59M91 61Q120 61 142 81" fill="none" stroke="#776593" stroke-width="3"/>
    <path d="M14 76Q29 67 59 68Q108 67 143 95L143 106Q114 89 87 87Q47 82 23 91L16 93Z" fill="#a28cbd"/>
    <path d="M25 85Q54 78 83 80Q113 81 135 95" fill="none" stroke="#baa5ce" stroke-width="3"/>
    <path d="M43 105Q48 102 54 104M91 106Q97 103 102 105" fill="none" stroke="#79584a" stroke-width="2.8"/>
    <path d="M42 114Q46 111 51 114L51 131Q47 134 43 131Z" fill="#55362d" stroke="#55362d"/>
    <path d="M92 115Q96 113 100 116L100 131Q97 134 93 132Z" fill="#55362d" stroke="#55362d"/>
    <circle cx="45" cy="117" r="1.8" fill="#fffaf0" stroke="none"/><circle cx="95" cy="118" r="1.6" fill="#fffaf0" stroke="none"/>
    <path d="M68 128Q72 123 74 129Q74 132 70 132Z" fill="#e9ae96" stroke="none"/>
    <ellipse cx="38" cy="137" rx="9" ry="4.5" fill="#f4c6b0" stroke="none"/><ellipse cx="105" cy="139" rx="8" ry="4.5" fill="#f4c6b0" stroke="none"/>
    <path d="M34 136L32 139M39 136L37 139M102 138L100 140M107 138L105 140" stroke="#d0927a" stroke-width="1"/>
    <path d="M64 143Q73 147 80 142" fill="none" stroke="#654237" stroke-width="1.8"/>
    <path d="M29 115Q55 110 77 114" fill="none" stroke="#fff9ed" stroke-width="3.5" opacity=".54"/>
  `,
};
