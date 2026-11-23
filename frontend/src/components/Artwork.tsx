import { useId } from "react";
export function Artwork({ kind = "space" }: { kind?: string }) {
  const id = useId().replaceAll(":", "");
  const palettes: Record<string, string[]> = {
    space: ["#352157", "#131323"],
    cinema: ["#e4ac6a", "#b47444"],
    tech: ["#a8bbae", "#34443b"],
    world: ["#7aafb1", "#d4d6b6"],
    music: ["#d98e99", "#6c354c"],
    sport: ["#9ba978", "#4c6648"],
    history: ["#b1a5bc", "#53425d"],
    business: ["#8195a8", "#2e4354"],
  };
  const colors = palettes[kind] || palettes.space;
  return (
    <svg
      className={`artwork art-${kind}`}
      viewBox="0 0 480 300"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}bg`}
          x1="70"
          y1="10"
          x2="400"
          y2="300"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
        <radialGradient id={`${id}orb`} cx=".3" cy=".2" r=".8">
          <stop stopColor="#ffdfab" />
          <stop offset=".42" stopColor="#e8a478" />
          <stop offset=".76" stopColor="#bf6a6a" />
          <stop offset="1" stopColor="#583759" />
        </radialGradient>
        <linearGradient
          id={`${id}metal`}
          x1="130"
          y1="70"
          x2="310"
          y2="250"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" />
          <stop offset=".27" stopColor="#d8cde7" />
          <stop offset=".5" stopColor="#877894" />
          <stop offset=".75" stopColor="#ebe8e4" />
          <stop offset="1" stopColor="#8b7d95" />
        </linearGradient>
        <filter id={`${id}shadow`}>
          <feDropShadow
            dx="6"
            dy="14"
            stdDeviation="10"
            floodColor="#0b061a"
            floodOpacity=".3"
          />
        </filter>
      </defs>
      <rect width="480" height="300" fill={`url(#${id}bg)`} />
      {kind === "space" && (
        <>
          <g opacity=".5" stroke="#a294bf" strokeWidth=".7">
            <ellipse
              cx="260"
              cy="155"
              rx="205"
              ry="78"
              transform="rotate(-26 260 155)"
            />
            <ellipse
              cx="260"
              cy="155"
              rx="250"
              ry="115"
              transform="rotate(-26 260 155)"
            />
          </g>
          <circle
            cx="268"
            cy="145"
            r="91"
            fill={`url(#${id}orb)`}
            filter={`url(#${id}shadow)`}
          />
          <path
            d="M182 117c50-32 114-20 170 17M179 145c51-24 113-10 174 23M194 184c43-11 88-2 133 17"
            stroke="#f7c699"
            strokeOpacity=".3"
            strokeWidth="8"
          />
          <ellipse
            cx="259"
            cy="158"
            rx="153"
            ry="29"
            transform="rotate(-26 259 158)"
            stroke="#d5c2e7"
            strokeWidth="8"
            strokeDasharray="265 320"
          />
          <circle cx="101" cy="81" r="9" fill="#b7a7da" />
          <circle cx="408" cy="214" r="5" fill="#e4b17c" />
          {[
            [60, 160],
            [390, 68],
            [158, 236],
            [360, 263],
            [222, 36],
            [434, 128],
            [62, 260],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`} stroke="#e0d0f2">
              <path d="M-3 0h6M0-3v6" />
            </g>
          ))}
        </>
      )}
      {kind === "cinema" && (
        <>
          <circle cx="239" cy="140" r="110" fill="#eabe88" opacity=".4" />
          <g
            transform="translate(127 88) rotate(-9 115 80)"
            filter={`url(#${id}shadow)`}
          >
            <rect y="25" width="227" height="135" rx="8" fill="#29272b" />
            <rect y="25" width="227" height="29" fill="#e9dfc7" />
            {[0, 46, 92, 138, 184].map((x) => (
              <path key={x} d={`M${x} 25l20 29h24l-20-29`} fill="#343136" />
            ))}
            <g transform="rotate(-15 0 25)">
              <rect width="227" height="27" rx="3" fill="#eee6d4" />
              {[0, 46, 92, 138, 184].map((x) => (
                <path key={x} d={`M${x} 0l20 27h24l-20-27`} fill="#343136" />
              ))}
            </g>
            <text
              x="21"
              y="93"
              fill="#e7decc"
              fontSize="13"
              fontFamily="monospace"
              letterSpacing="4"
            >
              TAKE YOUR SHOT
            </text>
            <path
              d="M20 108h185M20 137h185M85 110v27M156 110v27"
              stroke="#948b86"
            />
            <text
              x="21"
              y="128"
              fill="#e7decc"
              fontSize="10"
              fontFamily="monospace"
            >
              SCENE 01
            </text>
          </g>
        </>
      )}
      {kind === "tech" && (
        <>
          <path
            d="M0 60h480M0 120h480M0 180h480M0 240h480M60 0v300M120 0v300M180 0v300M240 0v300M300 0v300M360 0v300M420 0v300"
            stroke="#d0e5d4"
            opacity=".1"
          />
          <g
            transform="translate(246 145) rotate(-25)"
            filter={`url(#${id}shadow)`}
          >
            <rect
              x="-90"
              y="-81"
              width="180"
              height="180"
              rx="14"
              fill="#23352b"
              stroke="#a5b7a7"
              strokeWidth="3"
            />
            <rect
              x="-75"
              y="-66"
              width="150"
              height="150"
              rx="6"
              fill={`url(#${id}metal)`}
            />
            <rect
              x="-57"
              y="-48"
              width="114"
              height="114"
              rx="4"
              fill="#27352e"
            />
            <text
              x="0"
              y="3"
              textAnchor="middle"
              fill="#dbe8d3"
              fontSize="22"
              fontFamily="monospace"
              fontWeight="700"
            >
              THINK
            </text>
            <text
              x="0"
              y="27"
              textAnchor="middle"
              fill="#aabb9d"
              fontSize="12"
              fontFamily="monospace"
              letterSpacing="3"
            >
              DIFFERENT.
            </text>
            {Array.from({ length: 9 }, (_, i) => (
              <g key={i} stroke="#b4c0a7" strokeWidth="6">
                <path
                  d={`M${-68 + i * 17} -98v16M${-68 + i * 17} 100v16M-107 ${-59 + i * 17}h16M92 ${-59 + i * 17}h16`}
                />
              </g>
            ))}
          </g>
        </>
      )}
      {kind === "world" && (
        <>
          <circle cx="367" cy="64" r="32" fill="#fff1cb" />
          <path d="M0 218L136 58l82 96L304 78l176 172v50H0" fill="#486d6c" />
          <path
            d="M136 58l-49 80 44-20 18 24 20-24 49 36zM304 78l-57 91 53-30 35 27 18-15z"
            fill="#f0e9d5"
          />
          <path d="M0 240l113-63 96 63 121-64 150 83v41H0" fill="#294e4c" />
          <path d="M0 270c80-15 137 32 225 0s173-7 255-4v34H0" fill="#adbfad" />
          <path
            d="M65 287c116-38 210 36 355-9"
            stroke="#e3e2c7"
            strokeWidth="2"
          />
        </>
      )}
      {kind === "music" && (
        <>
          <circle
            cx="249"
            cy="153"
            r="109"
            fill="#241c28"
            filter={`url(#${id}shadow)`}
          />
          {[100, 89, 78, 67, 56].map((r) => (
            <circle
              key={r}
              cx="249"
              cy="153"
              r={r}
              stroke="#5d4555"
              opacity=".65"
            />
          ))}
          <circle cx="249" cy="153" r="38" fill="#e6b8a5" />
          <circle cx="249" cy="153" r="5" fill="#211d27" />
          <path
            d="M380 54v132l-73 24v-74l73-23"
            stroke="#d3b0b9"
            strokeWidth="10"
            strokeLinejoin="round"
          />
          <ellipse
            cx="292"
            cy="209"
            rx="25"
            ry="16"
            transform="rotate(-22 292 209)"
            fill="#dfbac2"
          />
        </>
      )}
      {kind === "sport" && (
        <>
          <path
            d="M0 150h480M240 0v300"
            stroke="#eff0d0"
            strokeWidth="3"
            opacity=".5"
          />
          <circle
            cx="240"
            cy="150"
            r="96"
            stroke="#eff0d0"
            strokeWidth="3"
            opacity=".5"
          />
          <circle
            cx="240"
            cy="145"
            r="80"
            fill="#dc9665"
            filter={`url(#${id}shadow)`}
          />
          <g stroke="#54382c" strokeWidth="4">
            <circle cx="240" cy="145" r="79" />
            <path d="M161 145h158M240 66v158M187 85c66 18 66 103 0 123M293 85c-66 18-66 103 0 123" />
          </g>
        </>
      )}
      {kind === "history" && (
        <>
          <circle cx="245" cy="145" r="103" fill="#d2bac4" opacity=".3" />
          <g filter={`url(#${id}shadow)`}>
            <path d="M133 114l109-65 109 65z" fill="#e2d5c5" />
            <path
              d="M127 114h230v20H127zM127 236h230v22H127zM116 258h252v17H116z"
              fill="#bba99c"
            />
            {[146, 197, 248, 299].map((x) => (
              <g key={x}>
                <path d={`M${x} 135h24v100h-24z`} fill="#dfd3c4" />
                <path
                  d={`M${x + 7} 141v87M${x + 17} 141v87`}
                  stroke="#aa968b"
                  strokeWidth="2"
                />
              </g>
            ))}
          </g>
        </>
      )}
      {kind === "business" && (
        <>
          <path d="M0 255h480" stroke="#d9e1e3" strokeOpacity=".2" />
          <g filter={`url(#${id}shadow)`}>
            {[
              [100, 161, 58],
              [170, 116, 58],
              [240, 76, 58],
              [310, 30, 58],
            ].map(([x, y, w], i) => (
              <g key={x}>
                <path
                  d={`M${x} ${y}h${w}v${255 - y}h-${w}z`}
                  fill={["#a4b9c0", "#b8ced1", "#c4d5d7", "#dce5df"][i]}
                />
                <path
                  d={`M${x + w} ${y}l15 13v${242 - y}h-15z`}
                  fill="#748f9d"
                />
                {Array.from({ length: Math.floor((235 - y) / 20) }, (_, n) => (
                  <path
                    key={n}
                    d={`M${x + 12} ${y + 15 + n * 20}h${w - 24}`}
                    stroke="#688797"
                    strokeWidth="4"
                  />
                ))}
              </g>
            ))}
          </g>
          <path
            d="M91 142L183 90l75-34 84-39"
            stroke="#f2ddb1"
            strokeWidth="3"
          />
          <path d="M329 16h16v16" stroke="#f2ddb1" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}
export function HeroArt() {
  return (
    <div className="hero-illustration" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="hero-spark spark-one">✦</div>
      <div className="hero-spark spark-two">✧</div>
      <div className="hero-orb" />
      <div className="floating-ticket ticket-back">
        <span>STAY</span>
        <strong>CURIOUS.</strong>
        <i>✦</i>
      </div>
      <div className="floating-ticket ticket-front">
        <span>THE NEXT BIG THING</span>
        <strong>
          is in
          <br />
          your head.
        </strong>
        <div className="ticket-bottom">
          <b>q✦</b>
          <span>LET’S FIND IT.</span>
        </div>
      </div>
      <div className="little-orb" />
    </div>
  );
}
