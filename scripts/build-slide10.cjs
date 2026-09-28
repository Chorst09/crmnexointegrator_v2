const fs = require('fs');
const { execSync } = require('child_process');

const W = 1448;
const H = 2048;
const photoH = 1120;

// 1. Prepare photo: resize cropped_content to width 1448, height 1175
execSync(`convert /tmp/cropped_content.png -resize ${W}x1175 +repage /tmp/photo_scaled.png`);

// 2. Crop top photo to 1448x1120 with soft gradient fade mask at bottom 100px
execSync(`convert /tmp/photo_scaled.png -crop ${W}x${photoH}+0+0 +repage /tmp/photo_cropped.png`);

// Create smooth alpha gradient for seamless blend into cyber navy #030d1a
execSync(`convert -size ${W}x${photoH} xc:black -fill white -draw "rectangle 0,0 ${W},980" -channel R -blur 0x25 /tmp/photo_mask.png`);
execSync(`convert /tmp/photo_cropped.png /tmp/photo_mask.png -alpha off -compose CopyOpacity -composite /tmp/photo_faded.png`);

// 3. Create SVG for the entire slide (bottom section + overlays)
const bottomH = H - photoH + 100; // Overlap 100px with photo for seamless integration
const svgOffsetY = photoH - 100;

const svgContent = `
<svg width="${W}" height="${bottomH}" viewBox="0 0 ${W} ${bottomH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="cyber-bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#041222" />
      <stop offset="35%" stop-color="#030d1a" />
      <stop offset="100%" stop-color="#020810" />
    </linearGradient>

    <!-- Center Ambient Glow -->
    <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0066aa" stop-opacity="0.35" />
      <stop offset="55%" stop-color="#003366" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#030d1a" stop-opacity="0" />
    </radialGradient>

    <!-- Neon Glow Filter -->
    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Clip Path for Interlocking Diamonds -->
    <clipPath id="interlock-clip">
      <rect x="-85" y="-85" width="170" height="80" />
    </clipPath>
  </defs>

  <!-- Background Base -->
  <rect width="${W}" height="${bottomH}" fill="url(#cyber-bg)" />
  <circle cx="724" cy="520" r="480" fill="url(#center-glow)" />

  <!-- Subtle Circuit Traces in Dark Background -->
  <g stroke="#093252" stroke-width="1.8" fill="none" opacity="0.75">
    <!-- Top Bus Lines -->
    <path d="M 60 140 L 350 140 L 380 170 L 700 170" />
    <circle cx="350" cy="140" r="3" fill="#0088cc" />
    <circle cx="700" cy="170" r="3" fill="#0088cc" />

    <path d="M 750 150 L 1100 150 L 1130 180 L 1380 180" />
    <circle cx="1100" cy="150" r="3" fill="#0088cc" />

    <!-- Left Vertical Traces -->
    <path d="M 85 200 L 85 410 L 115 440 L 115 730" />
    <circle cx="85" cy="290" r="3.5" fill="#0088cc" />
    <circle cx="115" cy="590" r="3.5" fill="#0088cc" />

    <path d="M 120 290 L 170 290 L 195 315 L 195 530" />
    <circle cx="195" cy="530" r="3" fill="#0088cc" />

    <!-- Right Vertical Traces -->
    <path d="M 1360 210 L 1360 450 L 1330 480 L 1330 790" />
    <circle cx="1360" cy="330" r="3.5" fill="#0088cc" />
    <circle cx="1330" cy="650" r="3.5" fill="#0088cc" />

    <path d="M 1320 330 L 1260 330 L 1235 355 L 1235 610" />
    <circle cx="1235" cy="610" r="3" fill="#0088cc" />

    <!-- Bottom Traces -->
    <path d="M 150 970 L 420 970 L 450 940 L 780 940" />
    <circle cx="420" cy="970" r="3" fill="#0088cc" />
    <circle cx="780" cy="940" r="3" fill="#0088cc" />

    <path d="M 820 980 L 1120 980 L 1150 950 L 1350 950" />
    <circle cx="1120" cy="980" r="3" fill="#0088cc" />
  </g>

  <!-- ==================== TECH HUD BORDER FRAME ==================== -->
  <!-- Outer Frame: starts X: 52, Y: 130, right: 1396, bottom: 975 -->
  <!-- Top-Right Chamfer: from (1326, 130) to (1396, 200) -->
  <!-- Bottom-Left Chamfer: from (122, 975) to (52, 905) -->
  <g filter="url(#neon-glow)">
    <!-- Main Neon Cyan Frame Line -->
    <path d="M 52 130 
             L 1326 130 
             L 1396 200 
             L 1396 975 
             L 122 975 
             L 52 905 
             Z" 
          fill="none" 
          stroke="#00b4d8" 
          stroke-width="3" 
          stroke-linejoin="miter" />

    <!-- Inner Parallel Line for Double-Line Tech Effect -->
    <path d="M 64 142 
             L 1320 142 
             L 1384 206 
             L 1384 963 
             L 130 963 
             L 64 897 
             Z" 
          fill="none" 
          stroke="#0077b6" 
          stroke-width="1.2" 
          opacity="0.6" />

    <!-- Top-Right Chamfer Outer Accents -->
    <path d="M 1334 118 L 1408 192" fill="none" stroke="#00b4d8" stroke-width="2.5" />
    <path d="M 1414 198 L 1414 235" fill="none" stroke="#00b4d8" stroke-width="2.5" />
    <circle cx="1414" cy="246" r="2.5" fill="#00b4d8" />

    <!-- Bottom-Left Chamfer Outer Accents -->
    <path d="M 114 987 L 40 913" fill="none" stroke="#00b4d8" stroke-width="2.5" />
    <path d="M 34 907 L 34 870" fill="none" stroke="#00b4d8" stroke-width="2.5" />
    <circle cx="34" cy="859" r="2.5" fill="#00b4d8" />

    <!-- Top-Left Corner Bracket Accents -->
    <path d="M 44 130 L 44 165" fill="none" stroke="#00b4d8" stroke-width="2" />
    <path d="M 52 122 L 85 122" fill="none" stroke="#00b4d8" stroke-width="2" />

    <!-- Bottom-Right Corner Bracket Accents -->
    <path d="M 1404 975 L 1404 940" fill="none" stroke="#00b4d8" stroke-width="2" />
    <path d="M 1396 983 L 1363 983" fill="none" stroke="#00b4d8" stroke-width="2" />

    <!-- 3 Tech Tick Bars inside bottom-left horizontal segment -->
    <rect x="175" y="967" width="22" height="4.5" fill="#00b4d8" />
    <rect x="206" y="967" width="22" height="4.5" fill="#00b4d8" />
    <rect x="237" y="967" width="22" height="4.5" fill="#00b4d8" />
  </g>

  <!-- ==================== DOUBLE BRAND IDENTITY ==================== -->
  <!-- Centered perfectly in the lower HUD card: X ≈ 724, Y ≈ 552 -->
  <g transform="translate(230, 395)">
    <!-- ICON: Interlocking Rounded Rhombuses -->
    <!-- Left Diamond: Dark Slate Indigo (#475569) -->
    <g transform="translate(145, 145) rotate(45)">
      <rect x="-65" y="-65" width="130" height="130" rx="26" ry="26" fill="none" stroke="#486581" stroke-width="28" />
    </g>

    <!-- Right Diamond: Vibrant Electric Sky Blue (#00b4d8) -->
    <g transform="translate(235, 145) rotate(45)">
      <rect x="-65" y="-65" width="130" height="130" rx="26" ry="26" fill="none" stroke="#00b4d8" stroke-width="28" />
    </g>

    <!-- Interlocking Weave: Left Diamond Top Portion Re-Drawn Over Right Diamond -->
    <g transform="translate(145, 145) rotate(45)">
      <rect x="-65" y="-65" width="130" height="130" rx="26" ry="26" fill="none" stroke="#486581" stroke-width="28" clip-path="url(#interlock-clip)" />
    </g>

    <!-- WORDMARK: 'double' in clean modern geometric typography -->
    <text x="355" y="195" font-family="'Liberation Sans', 'Nimbus Sans', Arial, Helvetica, sans-serif" font-size="145" font-weight="bold" fill="#00b4d8" letter-spacing="1">double</text>

    <!-- SUB-TAGLINE: 'ti + telecom' aligned under 'uble' -->
    <text x="630" y="260" font-family="'Liberation Sans', 'Nimbus Sans', Arial, Helvetica, sans-serif" font-size="44" font-weight="bold" fill="#ffffff" letter-spacing="3">ti + telecom</text>
  </g>
</svg>
`;

fs.writeFileSync('/tmp/slide10_bottom.svg', svgContent);
execSync('ffmpeg -y -v error -i /tmp/slide10_bottom.svg /tmp/slide10_bottom.png');

// Composite top photo and bottom section into full 1448x2048 PNG
execSync(`convert -size ${W}x${H} xc:#020810 /tmp/photo_faded.png -geometry +0+0 -composite /tmp/slide10_bottom.png -geometry +0+${svgOffsetY} -composite /tmp/slide10_final.png`);

// Convert final PNG to WebP with pristine quality
execSync('convert /tmp/slide10_final.png -quality 94 /app/applet/apps/web/public/proposal-templates/double/closing.webp');
execSync('cp /app/applet/apps/web/public/proposal-templates/double/closing.webp /app/applet/apps/web/dist/proposal-templates/double/closing.webp 2>/dev/null || true');

console.log('Successfully generated new high-fidelity closing.webp!');
console.log(execSync('identify /app/applet/apps/web/public/proposal-templates/double/closing.webp').toString());
