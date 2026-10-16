/* ===== Numeria Quest — Istana Zodiak (Istana Raja Iblis Ophiuchus) =====
   Dimuat PALING AKHIR (setelah cerita.js). Tidak mengubah file lain, hanya membungkus fungsi yang ada.
   Cara masuk: kalahkan Raja Iblis Tak Hingga di Kastil Raja Iblis, bicara dengan Peri Cahaya di aula takhta,
   lalu masuki gerbang ungu yang muncul di dekatnya (di petak sekitar Peri).
   Isi:
   - 12 lantai (ZF1..ZF12), tiap lantai dijaga satu bintang zodiak, urut Aries -> Pisces:
       Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces.
     Lantai berbentuk ruang berliku (4 ruang + lorong bos) dengan tangga naik/turun, kristal simpan, 2 peti,
     dan 4 monster biasa (muncul lagi tiap masuk lantai, bisa dihindari).
   - Aula Raja Iblis Ophiuchus (ZT) di puncak: Ophiuchus, bos terakhir.
   - Sprite pixel 32x32 (battle) dan 16x16 (peta) dibuat dari kode di bagian ZSP; bos digambar besar di peta.
   - Quest baru "Istana Zodiak" di Papan Quest (hadiah Pedang Ophiuchus).
   Data di F (ikut tersimpan): F.zodiakOpen (gerbang terbuka), F.zodiakOk (Ophiuchus kalah), F.done[indeks E], F.chest[id].
   Mengatur kekuatan: ubah rumus hp/atk pada bagian MONSTER. Mengatur ukuran lantai: FW / FH di PENGATURAN. */
(function () {
  /* ===================== SPRITE: generator pixel-art (murni, tidak bergantung game) ===================== */
  const ZSP = (() => {
    const N = 32;
    const G = () => Array.from({ length: N }, () => Array(N).fill("."));
    const put = (g, x, y, c) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c;
    };
    const rc = (g, x, y, w, h, c) => {
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) put(g, x + i, y + j, c);
    };
    const el = (g, cx, cy, rx, ry, c) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / (rx + 0.45),
            dy = (y - cy) / (ry + 0.45);
          if (dx * dx + dy * dy <= 1) put(g, x, y, c);
        }
    };
    const ln = (g, x0, y0, x1, y1, c, t = 1) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n,
          y = y0 + ((y1 - y0) * k) / n;
        for (let j = 0; j < t; j++)
          for (let i = 0; i < t; i++) put(g, x + i, y + j, c);
      }
    };
    const poly = (g, pts, c) => {
      const ys = pts.map((p) => p[1]),
        xs = pts.map((p) => p[0]);
      for (let y = Math.min(...ys); y <= Math.max(...ys); y++)
        for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i],
              [xj, yj] = pts[j];
            if (
              yi > y + 0.5 !== yj > y + 0.5 &&
              x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi
            )
              inside = !inside;
          }
          if (inside) put(g, x, y, c);
        }
    };
    // garis tepi gelap (K) di sekeliling semua piksel terisi
    const outline = (g) => {
      const o = g.map((r) => r.slice());
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          if (g[y][x] !== ".") continue;
          if (
            [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].some(([dx, dy]) => (g[y + dy]?.[x + dx] ?? ".") !== ".")
          )
            o[y][x] = "K";
        }
      return o.map((r) => r.join(""));
    };
    // versi dunia 16x16: tiap blok 2x2 diambil warna terbanyak
    const down = (rows) => {
      const out = [];
      for (let y = 0; y < N; y += 2) {
        let s = "";
        for (let x = 0; x < N; x += 2) {
          const c = [
              rows[y][x],
              rows[y][x + 1],
              rows[y + 1][x],
              rows[y + 1][x + 1],
            ].filter((v) => v !== "."),
            cnt = {};
          c.forEach((v) => (cnt[v] = (cnt[v] || 0) + 1));
          const nk = c.filter((v) => v !== "K");
          if (
            c.length >= 3 ||
            (c.length === 2 && nk.length) ||
            (c.length === 1 && nk.length)
          ) {
            const pool = nk.length ? nk : c;
            let b = pool[0];
            pool.forEach((v) => {
              if (
                pool.filter((q) => q === v).length >
                pool.filter((q) => q === b).length
              )
                b = v;
            });
            s += c.length >= 3 && nk.length < 2 ? "K" : b;
          } else s += c.length ? "K" : ".";
        }
        out.push(s);
      }
      return out;
    };
    // bingkai kedua: bagian atas turun 1 petak (napas)
    const breathe = (rows) => [
      ".".repeat(N),
      ...rows.slice(0, 19),
      ...rows.slice(20),
    ];

    const S = {};
    const def = (key, pal, draw) => {
      const g = G();
      draw(g);
      const m = outline(g);
      S[key] = {
        p: { K: "#0c0610", ...pal },
        big: m,
        big2: breathe(m),
        small: down(m),
        small2: down(breathe(m)),
      };
    };

    /* ===== 1. ARIES: ksatria domba merah, palu raksasa ===== */
    def(
      "zaries",
      {
        R: "#c8342e",
        r: "#7e1c1c",
        H: "#efe3bd",
        h: "#a89868",
        A: "#8d92a0",
        a: "#565b6a",
        S: "#d0d4e0",
        B: "#6b4a2a",
        b: "#3e2a16",
        Y: "#ffe14d",
        M: "#d0a040",
      },
      (g) => {
        ln(g, 6, 10, 14, 24, "B", 2); // gagang
        rc(g, 0, 2, 11, 8, "A");
        rc(g, 1, 3, 9, 2, "S");
        rc(g, 0, 7, 11, 2, "a");
        rc(g, 4, 2, 3, 8, "R");
        rc(g, 5, 4, 1, 4, "r");
        rc(g, 14, 23, 4, 6, "a");
        rc(g, 19, 23, 4, 6, "a");
        rc(g, 13, 28, 5, 2, "b");
        rc(g, 19, 28, 5, 2, "b");
        rc(g, 15, 21, 8, 4, "r");
        rc(g, 13, 13, 12, 9, "A");
        rc(g, 15, 14, 3, 5, "S");
        rc(g, 13, 20, 12, 2, "M");
        rc(g, 20, 14, 4, 5, "a");
        el(g, 11, 14, 3, 3, "A");
        el(g, 26, 14, 3, 3, "A");
        put(g, 10, 10, "S");
        put(g, 27, 10, "S");
        rc(g, 11, 17, 3, 5, "R");
        rc(g, 25, 17, 3, 6, "R");
        rc(g, 12, 21, 4, 3, "R");
        el(g, 19, 8, 5, 5, "R");
        el(g, 16, 11, 2, 2, "r");
        rc(g, 19, 6, 2, 1, "r");
        put(g, 17, 7, "Y");
        put(g, 21, 7, "Y");
        [
          [15, 4, 12, 3],
          [12, 3, 10, 5],
          [10, 5, 10, 9],
          [10, 9, 12, 11],
        ].forEach(([a, b, c, d]) => ln(g, a, b, c, d, "H", 2));
        [
          [23, 4, 26, 3],
          [26, 3, 28, 5],
          [28, 5, 28, 9],
          [28, 9, 26, 11],
        ].forEach(([a, b, c, d]) => ln(g, a, b, c, d, "H", 2));
        put(g, 10, 7, "h");
        put(g, 28, 7, "h");
      },
    );

    /* ===== 2. TAURUS: minotaur cokelat, kapak & perisai ===== */
    def(
      "ztaurus",
      {
        B: "#8a5a3a",
        b: "#5e3a22",
        H: "#efe3bd",
        h: "#a89868",
        A: "#7c8090",
        a: "#4e5262",
        G: "#d0a040",
        S: "#cfc6b4",
        s: "#8a4a30",
        X: "#d0d4e0",
        x: "#7a7e90",
        W: "#6a4a2a",
        E: "#ffcc66",
        N: "#ffd24a",
      },
      (g) => {
        ln(g, 9, 9, 10, 29, "W", 2);
        el(g, 5, 10, 3, 5, "X");
        rc(g, 5, 6, 5, 9, "X");
        rc(g, 5, 11, 5, 2, "x");
        rc(g, 0, 8, 3, 5, "X");
        put(g, 1, 9, "x");
        rc(g, 14, 23, 4, 6, "b");
        rc(g, 19, 23, 4, 6, "b");
        rc(g, 13, 28, 5, 2, "a");
        rc(g, 19, 28, 5, 2, "a");
        rc(g, 13, 13, 11, 10, "B");
        rc(g, 13, 14, 11, 5, "A");
        rc(g, 15, 14, 3, 4, "X");
        rc(g, 13, 21, 11, 2, "G");
        rc(g, 11, 15, 3, 7, "B");
        rc(g, 10, 20, 4, 3, "b");
        el(g, 26, 20, 4, 6, "s");
        el(g, 26, 20, 3, 5, "S");
        rc(g, 26, 16, 1, 9, "s");
        rc(g, 23, 20, 7, 1, "s");
        put(g, 26, 20, "G");
        el(g, 18, 8, 5, 5, "B");
        el(g, 15, 11, 3, 3, "b");
        ln(g, 14, 5, 10, 3, "H", 2);
        ln(g, 10, 3, 9, 0, "H", 2);
        ln(g, 22, 5, 26, 3, "H", 2);
        ln(g, 26, 3, 27, 0, "H", 2);
        put(g, 11, 3, "h");
        put(g, 25, 3, "h");
        put(g, 12, 7, "b");
        put(g, 25, 7, "b");
        put(g, 17, 7, "E");
        put(g, 21, 7, "E");
        put(g, 14, 12, "N");
        put(g, 14, 13, "N");
        put(g, 15, 13, "N");
      },
    );

    /* ===== 3. GEMINI: si kembar berkerudung membawa belati ===== */
    def(
      "zgemini",
      {
        P: "#9a86e0",
        p: "#6a54b0",
        Q: "#a04058",
        q: "#5e2236",
        F: "#140a22",
        E: "#ff7acb",
        S: "#d8c8f0",
        D: "#e8eef8",
        d: "#9aa0b8",
        L: "#c8baf4",
      },
      (g) => {
        const twin = (cx, A, B, hl, dg) => {
          rc(g, cx - 3, 24, 2, 6, B);
          rc(g, cx + 1, 24, 2, 6, B);
          poly(
            g,
            [
              [cx - 3, 13],
              [cx + 3, 13],
              [cx + 5, 26],
              [cx - 5, 26],
            ],
            A,
          );
          rc(g, cx - 5, 25, 11, 2, B);
          ln(g, cx, 14, cx, 25, B);
          el(g, cx, 8, 4, 5, A);
          el(g, cx, 9, 2, 3, "F");
          put(g, cx - 1, 9, "E");
          put(g, cx + 1, 9, "E");
          ln(g, cx - 3, 4, cx - 1, 3, hl);
          rc(g, cx - 5, 15, 2, 6, A);
          rc(g, cx + 4, 15, 2, 6, A);
          rc(g, cx - 5, 20, 2, 2, "S");
          rc(g, cx + 4, 20, 2, 2, "S");
          ln(g, cx + dg * 6, 15, cx + dg * 6, 22, "D");
          put(g, cx + dg * 6, 14, "d");
        };
        twin(8, "P", "p", "L", -1);
        twin(23, "Q", "q", "P", 1);
        rc(g, 14, 20, 4, 2, "S"); // tangan bergandengan
        ln(g, 12, 17, 15, 20, "S");
        ln(g, 20, 17, 17, 20, "S");
      },
    );

    /* ===== 4. CANCER: kepiting raksasa merah ===== */
    def(
      "zcancer",
      {
        R: "#c8302e",
        r: "#7e1818",
        L: "#ec6a58",
        E: "#ffffff",
        e: "#201010",
        O: "#e08a60",
      },
      (g) => {
        [
          [9, 21, 2, 26],
          [10, 24, 3, 30],
          [12, 26, 7, 31],
        ].forEach(([a, b, c, d]) => ln(g, a, b, c, d, "r", 2));
        [
          [22, 21, 29, 26],
          [21, 24, 28, 30],
          [19, 26, 24, 31],
        ].forEach(([a, b, c, d]) => ln(g, a, b, c, d, "r", 2));
        // capit kiri: lengan + bola capit dengan celah menganga
        ln(g, 9, 18, 6, 13, "R", 3);
        el(g, 6, 8, 5.5, 5.5, "R");
        poly(
          g,
          [
            [6, 9],
            [1, 0],
            [7, 1],
          ],
          ".",
        );
        poly(
          g,
          [
            [6, 9],
            [11, 3],
            [11, 9],
          ],
          "R",
        );
        ln(g, 3, 9, 3, 12, "r");
        ln(g, 5, 10, 9, 10, "r");
        // capit kanan
        ln(g, 22, 18, 25, 13, "R", 3);
        el(g, 25, 8, 5.5, 5.5, "R");
        poly(
          g,
          [
            [25, 9],
            [30, 0],
            [24, 1],
          ],
          ".",
        );
        poly(
          g,
          [
            [25, 9],
            [20, 3],
            [20, 9],
          ],
          "R",
        );
        ln(g, 28, 9, 28, 12, "r");
        ln(g, 22, 10, 26, 10, "r");
        el(g, 16, 21, 9, 6, "R");
        el(g, 16, 19, 7, 4, "L");
        ln(g, 8, 21, 24, 21, "r");
        [11, 14, 17, 20].forEach((x) => ln(g, x, 16, x + 1, 25, "r"));
        [
          [13, 13],
          [19, 13],
        ].forEach(([x, y]) => {
          ln(g, x, y + 3, x, y, "r");
          el(g, x, y - 1, 1, 1, "E");
          put(g, x, y - 1, "e");
        });
        [
          [13, 16],
          [16, 15],
          [19, 16],
        ].forEach(([x, y]) => put(g, x, y, "O"));
      },
    );

    /* ===== 5. LEO: singa berzirah oranye, pedang api ===== */
    def(
      "zleo",
      {
        M: "#e0801a",
        m: "#a8440e",
        l: "#7a2c08",
        L: "#ffd890",
        O: "#f0a030",
        o: "#b46a18",
        G: "#7a8090",
        g: "#4e5262",
        F: "#ffd24a",
        f: "#ff6a22",
        E: "#2a1408",
        S: "#6a728a",
        W: "#ffffff",
        N: "#c8501e",
      },
      (g) => {
        poly(
          g,
          [
            [4, 28],
            [2, 26],
            [14, 15],
            [17, 18],
          ],
          "f",
        );
        ln(g, 4, 27, 15, 17, "F", 2);
        ln(g, 5, 29, 14, 20, "f");
        put(g, 3, 25, "W");
        rc(g, 13, 17, 5, 2, "g");
        ln(g, 30, 22, 25, 25, "m", 2);
        ln(g, 25, 25, 24, 22, "m");
        put(g, 30, 21, "f");
        put(g, 30, 20, "F");
        rc(g, 14, 23, 4, 6, "G");
        rc(g, 19, 23, 4, 6, "G");
        rc(g, 13, 28, 5, 2, "g");
        rc(g, 19, 28, 5, 2, "g");
        rc(g, 13, 15, 12, 9, "O");
        rc(g, 15, 16, 3, 5, "F");
        rc(g, 21, 16, 2, 6, "o");
        rc(g, 13, 22, 12, 2, "o");
        el(g, 12, 15, 3, 3, "O");
        el(g, 25, 15, 3, 3, "O");
        put(g, 11, 13, "F");
        put(g, 26, 13, "F");
        rc(g, 11, 17, 3, 5, "L");
        rc(g, 25, 17, 6, 8, "S");
        rc(g, 26, 18, 4, 6, "G");
        rc(g, 28, 18, 1, 6, "S");
        el(g, 19, 8, 8, 7.5, "m");
        el(g, 19, 8, 6.5, 6.5, "M");
        [
          [13, 3],
          [15, 1],
          [19, 0],
          [23, 1],
          [25, 3],
        ].forEach(([x, y]) => put(g, x, y, "m"));
        ln(g, 13, 6, 12, 12, "m");
        ln(g, 25, 6, 26, 12, "m");
        ln(g, 15, 3, 14, 9, "o");
        ln(g, 23, 3, 24, 9, "o");
        el(g, 18, 9.5, 4, 4, "L");
        rc(g, 14, 3, 2, 2, "L");
        rc(g, 22, 3, 2, 2, "L");
        put(g, 16, 8, "E");
        put(g, 20, 8, "E");
        put(g, 17, 8, "W");
        put(g, 21, 8, "W");
        rc(g, 16, 10, 3, 2, "N");
        put(g, 17, 10, "E");
        ln(g, 15, 13, 21, 13, "E");
      },
    );

    /* ===== 6. VIRGO: wanita bersayap hijau, tongkat ===== */
    def(
      "zvirgo",
      {
        G: "#86b878",
        g: "#4e8050",
        D: "#5a8a50",
        d: "#2e4e30",
        W: "#8a7458",
        w: "#4a3a28",
        H: "#2e4a2e",
        h: "#5e9a5a",
        T: "#3a3a46",
        E: "#ffe14d",
        Y: "#c8e8a8",
      },
      (g) => {
        poly(
          g,
          [
            [13, 13],
            [8, 6],
            [1, 2],
            [2, 9],
            [4, 14],
            [9, 21],
            [13, 19],
          ],
          "W",
        );
        poly(
          g,
          [
            [19, 13],
            [24, 6],
            [31, 2],
            [30, 9],
            [28, 14],
            [23, 21],
            [19, 19],
          ],
          "W",
        );
        [
          [13, 14, 3, 5],
          [13, 15, 4, 11],
          [13, 16, 6, 17],
        ].forEach(([a, b, c, d]) => {
          ln(g, a, b, c, d, "w");
          ln(g, 32 - a, b, 32 - c, d, "w");
        });
        ln(g, 7, 4, 8, 30, "T", 1);
        rc(g, 6, 1, 3, 3, "T");
        put(g, 7, 2, "Y");
        poly(
          g,
          [
            [12, 15],
            [20, 15],
            [23, 30],
            [9, 30],
          ],
          "D",
        );
        [10, 12, 15, 18, 21].forEach((x) => put(g, x, 30, "."));
        ln(g, 13, 22, 11, 29, "d");
        ln(g, 19, 22, 21, 29, "d");
        ln(g, 16, 20, 16, 29, "d");
        rc(g, 12, 19, 9, 2, "d");
        rc(g, 12, 11, 9, 5, "D");
        rc(g, 14, 12, 2, 3, "g");
        rc(g, 11, 4, 11, 4, "H");
        rc(g, 11, 6, 2, 11, "H");
        rc(g, 20, 6, 2, 11, "H");
        ln(g, 12, 17, 11, 21, "h");
        el(g, 16, 8, 3, 3, "G");
        put(g, 15, 8, "E");
        put(g, 18, 8, "E");
        ln(g, 12, 13, 9, 17, "G", 2);
        ln(g, 21, 13, 22, 20, "G", 2);
      },
    );

    /* ===== 7. LIBRA: hantu berjubah biru, sabit & timbangan ===== */
    def(
      "zlibra",
      {
        B: "#2c4ca4",
        b: "#1a2c70",
        L: "#5a80dc",
        F: "#05060c",
        E: "#cfe8ff",
        S: "#3a3a48",
        C: "#a4b8d0",
        c: "#6a7a90",
        G: "#a0a0b8",
        g: "#6a6a84",
      },
      (g) => {
        ln(g, 5, 30, 8, 5, "S", 1);
        poly(
          g,
          [
            [6, 6],
            [9, 2],
            [15, 1],
            [20, 4],
            [14, 3],
            [9, 5],
          ],
          "C",
        );
        ln(g, 8, 5, 14, 3, "c");
        poly(
          g,
          [
            [16, 4],
            [22, 8],
            [25, 17],
            [28, 30],
            [6, 30],
            [9, 17],
            [11, 8],
          ],
          "B",
        );
        ln(g, 12, 14, 10, 29, "b");
        ln(g, 16, 15, 16, 29, "b");
        ln(g, 21, 14, 23, 29, "b");
        ln(g, 10, 12, 8, 28, "L");
        rc(g, 7, 28, 21, 2, "b");
        el(g, 16, 9, 3, 4, "F");
        put(g, 15, 9, "E");
        put(g, 17, 9, "E");
        ln(g, 25, 13, 25, 29, "S");
        ln(g, 20, 14, 30, 14, "G");
        ln(g, 20, 14, 20, 19, "g");
        ln(g, 30, 14, 30, 19, "g");
        rc(g, 18, 19, 5, 2, "G");
        rc(g, 28, 19, 4, 2, "G");
        rc(g, 23, 29, 5, 1, "g");
        rc(g, 22, 16, 3, 3, "B");
      },
    );

    /* ===== 8. SCORPIO: penyihir kalajengking ungu, capit merah muda menyala ===== */
    def(
      "zscorpio",
      {
        P: "#6a3aa8",
        p: "#3a1e70",
        V: "#8a58d0",
        C: "#ff6ae0",
        c: "#b020a0",
        E: "#ffb0f0",
        F: "#0a0414",
        T: "#5a34a0",
        t: "#2e1664",
        W: "#ffffff",
      },
      (g) => {
        [
          [22, 27],
          [26, 25],
          [28, 20],
          [27, 14],
          [24, 9],
          [20, 6],
        ].forEach(([x, y], i) =>
          el(g, x, y, 2.4 - i * 0.12, 2.4 - i * 0.12, i % 2 ? "V" : "T"),
        );
        poly(
          g,
          [
            [17, 3],
            [22, 6],
            [19, 8],
            [17, 6],
            [15, 7],
          ],
          "C",
        );
        put(g, 16, 8, "C");
        put(g, 15, 9, "W");
        rc(g, 12, 28, 3, 3, "p");
        rc(g, 18, 28, 3, 3, "p");
        poly(
          g,
          [
            [12, 14],
            [21, 14],
            [25, 29],
            [8, 29],
          ],
          "P",
        );
        ln(g, 13, 17, 11, 28, "p");
        ln(g, 20, 17, 22, 28, "p");
        ln(g, 16, 18, 16, 28, "p");
        rc(g, 9, 26, 15, 2, "p");
        rc(g, 13, 20, 7, 1, "V");
        el(g, 16, 9, 5, 6, "P");
        el(g, 16, 10, 3, 4, "F");
        put(g, 15, 10, "E");
        put(g, 17, 10, "E");
        ln(g, 12, 16, 8, 20, "P", 2);
        ln(g, 21, 16, 25, 20, "P", 2);
        // capit menyala
        poly(
          g,
          [
            [8, 17],
            [3, 14],
            [2, 19],
            [4, 24],
            [8, 22],
            [5, 20],
          ],
          "C",
        );
        poly(
          g,
          [
            [6, 18],
            [4, 17],
            [4, 20],
          ],
          "c",
        );
        poly(
          g,
          [
            [25, 17],
            [30, 14],
            [31, 19],
            [29, 24],
            [25, 22],
            [28, 20],
          ],
          "C",
        );
        poly(
          g,
          [
            [27, 18],
            [29, 17],
            [29, 20],
          ],
          "c",
        );
      },
    );

    /* ===== 9. SAGITTARIUS: sentaur merah, busur ===== */
    def(
      "zsagit",
      {
        R: "#c8503e",
        r: "#7e2a22",
        B: "#a0562e",
        b: "#6a3018",
        M: "#4a2410",
        W: "#d0a850",
        w: "#8a6a2a",
        S: "#f0f0f0",
        A: "#e0e0e8",
        H: "#3a2010",
        E: "#ffe14d",
      },
      (g) => {
        ln(g, 29, 18, 31, 25, "M", 2);
        el(g, 22, 21, 8, 4, "B");
        el(g, 22, 19, 7, 2, "B");
        rc(g, 14, 24, 2, 6, "b");
        rc(g, 17, 24, 2, 6, "B");
        rc(g, 25, 24, 2, 6, "b");
        rc(g, 28, 24, 2, 6, "B");
        [
          [14, 29],
          [17, 29],
          [25, 29],
          [28, 29],
        ].forEach(([x, y]) => rc(g, x, y, 2, 2, "M"));
        el(g, 15, 18, 3, 4, "B");
        ln(g, 20, 17, 28, 20, "b");
        rc(g, 11, 10, 7, 9, "R");
        rc(g, 12, 12, 5, 1, "r");
        rc(g, 12, 15, 5, 1, "r");
        el(g, 13, 6, 3, 3, "R");
        put(g, 12, 6, "E");
        rc(g, 12, 2, 4, 2, "H");
        ln(g, 16, 4, 20, 7, "H", 2);
        [
          [6, 3],
          [4, 7],
          [3, 12],
          [4, 17],
          [6, 21],
        ].reduce((a, b) => (ln(g, a[0], a[1], b[0], b[1], "W", 2), b));
        ln(g, 6, 3, 13, 11, "S");
        ln(g, 13, 11, 6, 21, "S");
        ln(g, 1, 11, 14, 11, "A");
        poly(
          g,
          [
            [0, 11],
            [3, 9],
            [3, 13],
          ],
          "A",
        );
        ln(g, 14, 12, 6, 12, "R", 2);
        ln(g, 17, 12, 13, 11, "R", 2);
        rc(g, 4, 11, 3, 3, "R");
      },
    );

    /* ===== 10. CAPRICORN: iblis kambing cokelat gelap & ular ===== */
    def(
      "zcapri",
      {
        B: "#5a3a30",
        b: "#3a2420",
        H: "#c4a878",
        h: "#8a7050",
        E: "#ffe14d",
        S: "#2a7a64",
        s: "#1a4a3c",
        e: "#8ad0b0",
        L: "#7a5240",
      },
      (g) => {
        [
          [12, 29],
          [5, 28],
          [2, 23],
          [4, 18],
          [9, 16],
        ].reduce((a, b) => (ln(g, a[0], a[1], b[0], b[1], "S", 3), b));
        ln(g, 5, 28, 12, 29, "s", 1);
        rc(g, 7, 12, 6, 5, "S");
        put(g, 8, 13, "E");
        put(g, 7, 15, "e");
        put(g, 6, 14, "e");
        rc(g, 14, 13, 11, 10, "B");
        rc(g, 15, 14, 3, 4, "L");
        rc(g, 20, 14, 3, 4, "L");
        ln(g, 14, 19, 24, 19, "b");
        rc(g, 11, 14, 3, 8, "B");
        rc(g, 25, 14, 3, 8, "B");
        rc(g, 11, 21, 3, 3, "b");
        rc(g, 25, 21, 3, 3, "b");
        rc(g, 14, 22, 5, 4, "B");
        rc(g, 20, 22, 5, 4, "B");
        ln(g, 16, 26, 15, 29, "b", 2);
        ln(g, 22, 26, 23, 29, "b", 2);
        rc(g, 13, 29, 4, 2, "h");
        rc(g, 22, 29, 4, 2, "h");
        el(g, 19, 8, 4, 5, "B");
        rc(g, 15, 9, 4, 5, "b");
        rc(g, 17, 14, 2, 3, "b");
        ln(g, 21, 4, 24, 2, "H", 2);
        ln(g, 24, 2, 27, 4, "H", 2);
        ln(g, 27, 4, 28, 8, "H", 2);
        ln(g, 17, 4, 14, 2, "H", 2);
        ln(g, 14, 2, 12, 5, "H", 2);
        put(g, 25, 2, "h");
        put(g, 13, 2, "h");
        put(g, 17, 7, "E");
        put(g, 21, 7, "E");
        put(g, 16, 10, "B");
      },
    );

    /* ===== 11. AQUARIUS: roh air toska, kendi mengucur ===== */
    def(
      "zaqua",
      {
        C: "#3ac8c0",
        c: "#1a8a8a",
        L: "#9af4ec",
        W: "#3a90e0",
        w: "#b0dcff",
        J: "#2aa0b0",
        j: "#146878",
        D: "#1a5a6a",
      },
      (g) => {
        el(g, 13, 25, 6, 4, "C");
        poly(
          g,
          [
            [10, 20],
            [18, 20],
            [14, 28],
            [6, 30],
            [3, 27],
            [7, 28],
          ],
          "C",
        );
        ln(g, 6, 28, 2, 25, "C", 2);
        ln(g, 5, 24, 3, 22, "c");
        rc(g, 11, 11, 8, 11, "C");
        ln(g, 12, 12, 12, 21, "L");
        ln(g, 17, 14, 17, 21, "c");
        el(g, 15, 7, 3, 4, "C");
        ln(g, 13, 4, 14, 3, "L");
        put(g, 14, 6, "L");
        ln(g, 12, 13, 8, 17, "C", 2);
        // kendi
        poly(
          g,
          [
            [19, 12],
            [29, 14],
            [30, 20],
            [26, 23],
            [21, 20],
          ],
          "J",
        );
        ln(g, 20, 13, 28, 15, "L");
        ln(g, 21, 19, 25, 22, "j");
        rc(g, 24, 11, 4, 3, "J");
        rc(g, 24, 10, 4, 1, "j");
        ln(g, 18, 15, 20, 15, "C", 2);
        // air
        rc(g, 25, 23, 4, 7, "W");
        rc(g, 26, 23, 1, 7, "w");
        rc(g, 22, 29, 9, 2, "W");
        put(g, 23, 28, "w");
        put(g, 30, 28, "w");
        put(g, 28, 26, "w");
      },
    );

    /* ===== 12. PISCES: putri duyung biru, dua trisula ===== */
    def(
      "zpisces",
      {
        S: "#5ab0d4",
        s: "#2a78a8",
        H: "#2a5aa8",
        h: "#4a8ae0",
        T: "#2a6ac0",
        t: "#1a4488",
        L: "#80c8f4",
        G: "#a8c4e0",
        g: "#5a7898",
        E: "#ffe14d",
        F: "#2a9a8a",
      },
      (g) => {
        [3, 28].forEach((x) => {
          ln(g, x, 5, x, 30, "G");
          ln(g, x - 2, 2, x - 2, 7, "G");
          ln(g, x, 1, x, 6, "G");
          ln(g, x + 2, 2, x + 2, 7, "G");
          rc(g, x - 2, 6, 5, 1, "G");
          put(g, x, 22, "g");
        });
        ln(g, 17, 20, 15, 26, "T", 5);
        ln(g, 15, 26, 11, 29, "T", 4);
        poly(
          g,
          [
            [13, 27],
            [5, 24],
            [7, 28],
            [4, 31],
            [12, 31],
          ],
          "T",
        );
        ln(g, 8, 26, 12, 29, "t");
        ln(g, 6, 28, 11, 30, "t");
        ln(g, 16, 22, 15, 26, "L");
        rc(g, 12, 12, 8, 8, "S");
        rc(g, 12, 15, 8, 3, "T");
        put(g, 14, 16, "L");
        put(g, 17, 16, "L");
        rc(g, 11, 3, 10, 4, "H");
        rc(g, 11, 6, 2, 12, "H");
        rc(g, 19, 6, 2, 12, "H");
        ln(g, 12, 17, 11, 20, "h");
        el(g, 16, 9, 3, 4, "S");
        put(g, 15, 8, "E");
        put(g, 17, 8, "E");
        put(g, 21, 7, "F");
        put(g, 22, 8, "F");
        put(g, 10, 7, "F");
        put(g, 9, 8, "F");
        ln(g, 12, 13, 4, 14, "S", 2);
        ln(g, 20, 13, 27, 14, "S", 2);
      },
    );

    /* ===== RAJA IBLIS OPHIUCHUS: zirah hitam-emas, mahkota, tanduk, ular hitam, aura ungu ===== */
    def(
      "zophi",
      {
        B: "#1c1c2c",
        b: "#0e0e18",
        G: "#e8b83a",
        g: "#a47a1a",
        H: "#2a2a3a",
        h: "#5a5a74",
        P: "#8a4aff",
        p: "#3a1a78",
        C: "#4a1a6a",
        c: "#2a0e44",
        S: "#16161e",
        E: "#ff3a6a",
        Y: "#ffd24a",
        W: "#ffffff",
      },
      (g) => {
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++) {
            const d = Math.hypot((x - 16) / 15.5, (y - 17) / 16.5);
            if (d < 1 && d > 0.78 && (x + y) % 2 === 0)
              put(g, x, y, d > 0.9 ? "P" : "p");
          }
        [
          [27, 28],
          [29, 22],
          [28, 15],
          [26, 10],
          [27, 6],
        ].reduce((a, b) => (ln(g, a[0], a[1], b[0], b[1], "S", 3), b));
        poly(
          g,
          [
            [25, 1],
            [30, 2],
            [29, 5],
            [25, 5],
          ],
          "S",
        );
        put(g, 26, 2, "E");
        put(g, 27, 2, "E");
        poly(
          g,
          [
            [7, 12],
            [25, 12],
            [29, 30],
            [3, 30],
          ],
          "C",
        );
        [8, 12, 20, 24].forEach((x) =>
          ln(g, x, 14, x + (x < 16 ? -2 : 2), 30, "c"),
        );
        rc(g, 11, 22, 4, 8, "B");
        rc(g, 17, 22, 4, 8, "B");
        rc(g, 11, 25, 4, 1, "G");
        rc(g, 17, 25, 4, 1, "G");
        rc(g, 10, 29, 5, 2, "b");
        rc(g, 17, 29, 5, 2, "b");
        poly(
          g,
          [
            [9, 12],
            [23, 12],
            [21, 22],
            [11, 22],
          ],
          "B",
        );
        ln(g, 16, 12, 16, 22, "G");
        ln(g, 12, 14, 14, 18, "g");
        ln(g, 20, 14, 18, 18, "g");
        rc(g, 11, 21, 10, 2, "G");
        rc(g, 14, 22, 4, 7, "C");
        put(g, 16, 28, "G");
        put(g, 15, 24, "G");
        put(g, 16, 25, "G");
        put(g, 17, 24, "G");
        el(g, 7, 13, 4, 3, "B");
        el(g, 25, 13, 4, 3, "B");
        ln(g, 4, 12, 10, 12, "G");
        ln(g, 22, 12, 28, 12, "G");
        ln(g, 6, 11, 4, 6, "H", 2);
        ln(g, 26, 11, 28, 6, "H", 2);
        rc(g, 5, 15, 4, 8, "B");
        rc(g, 23, 15, 4, 8, "B");
        rc(g, 5, 22, 4, 3, "G");
        rc(g, 23, 22, 4, 3, "G");
        rc(g, 13, 6, 6, 7, "B");
        rc(g, 14, 8, 4, 4, "K");
        put(g, 14, 9, "E");
        put(g, 17, 9, "E");
        put(g, 14, 10, "W");
        rc(g, 12, 5, 8, 1, "G");
        [
          [12, 4],
          [14, 3],
          [16, 2],
          [18, 3],
          [20, 4],
        ].forEach(([x, y]) => ln(g, x, y, x, 4, "Y"));
        put(g, 16, 4, "E");
        ln(g, 12, 6, 7, 4, "H", 2);
        ln(g, 7, 4, 4, 0, "H", 2);
        ln(g, 20, 6, 25, 4, "H", 2);
        ln(g, 25, 4, 28, 0, "H", 2);
        put(g, 5, 2, "h");
        put(g, 27, 2, "h");
      },
    );

    return S;
  })();

  /* ===================== PENGATURAN (mudah diubah) ===================== */
  const FW = 25, // lebar tiap lantai (petak)
    FH = 29, // tinggi tiap lantai
    CX = 12, // kolom tengah (tangga & bos)
    TW = 21, // aula takhta Ophiuchus
    TH_ = 19,
    MINIONS = true, // false = lantai tanpa monster biasa (hanya penjaga)
    ALL = ["arit", "pecahan", "persen", "geom", "alj"];

  /* ---------- tema warna per elemen ---------- */
  const ELM = {
    api: {
      th: "zf",
      acc: "#ff7a32",
      car: "#8a1c2a",
      bg: ["#3a0c08", "#a8321a", "#2a0806", "#ffb060"],
    },
    bumi: {
      th: "ze",
      acc: "#9ac060",
      car: "#2a6a3a",
      bg: ["#16240e", "#4a6a2a", "#101a0a", "#d0e890"],
    },
    udara: {
      th: "za",
      acc: "#cfc8ff",
      car: "#4a3a9a",
      bg: ["#1c1a48", "#6a64c0", "#14123a", "#e0dcff"],
    },
    air: {
      th: "zw",
      acc: "#7cd8ff",
      car: "#1a5a8a",
      bg: ["#081c3a", "#2a6ab0", "#06142c", "#a0e8ff"],
    },
  };
  const ACC = {
      zf: "#ff7a32",
      ze: "#9ac060",
      za: "#cfc8ff",
      zw: "#7cd8ff",
      zt: "#ffd24a",
    },
    CAR = {
      zf: "#8a1c2a",
      ze: "#2a6a3a",
      za: "#4a3a9a",
      zw: "#1a5a8a",
      zt: "#5a1a8a",
    };
  Object.assign(TH, {
    zf: {
      a: "#3a1c22",
      b: "#341820",
      w: "#1a0a10",
      w2: "#7a2a1a",
      t: "#7a2a3a",
      t2: "#ff7a32",
    },
    ze: {
      a: "#2c3826",
      b: "#273222",
      w: "#121a10",
      w2: "#4a6a34",
      t: "#3a5a2a",
      t2: "#9ac060",
    },
    za: {
      a: "#38345a",
      b: "#322e52",
      w: "#16142c",
      w2: "#6a62a8",
      t: "#5a54a0",
      t2: "#cfc8ff",
    },
    zw: {
      a: "#1a3248",
      b: "#162c40",
      w: "#08121e",
      w2: "#2a6a98",
      t: "#2a6a98",
      t2: "#7cd8ff",
    },
    zt: {
      a: "#201428",
      b: "#1b1022",
      w: "#0a0610",
      w2: "#6a3a98",
      t: "#6a3a98",
      t2: "#ffd24a",
    },
  });

  /* ---------- data 12 bintang zodiak (urutan lantai 1..12) ----------
     k = kunci sprite, n = nama bintang, t = nama lengkap bos, el = elemen, weak = soal kelemahan,
     at = tipe serangan (jarak dekat / jarak jauh + jenis tembakan) */
  const M_ = { atkT: "melee" },
    R_ = (shot, n2, shotCol) => ({ atkT: "ranged", shot, n2, shotCol });
  const SIGNS = [
    {
      k: "zaries",
      n: "Aries",
      t: "Aries Palu Faktorial",
      el: "api",
      weak: "geom",
      at: M_,
      intro:
        'Palu raksasa menghantam lantai hingga bergetar. Aries, penjaga pertama, mendengus: "Kamu kira angka sanggup menahan palu ini?"',
      win: "Palu Aries jatuh berdentang. Sang domba merah mengangguk dan membuka tangga ke lantai dua.",
      who: "Prajurit Pembelot",
      say: [
        "Selamat datang di Istana Zodiak. Dua belas bintang menjaga dua belas lantai, dan di puncaknya duduk Ophiuchus, bintang ketiga belas yang tidak diakui langit.",
        "Lantai ini dijaga Aries dengan palu faktorial. Pukulannya keras tapi lambat.",
      ],
    },
    {
      k: "ztaurus",
      n: "Taurus",
      t: "Taurus Kapak Pecahan",
      el: "bumi",
      weak: "pecahan",
      at: M_,
      intro:
        'Taurus menyeruduk lantai dengan kapak terangkat, sekokoh pecahan yang tidak bisa disederhanakan. "Lewati aku kalau bisa membagi dengan benar!"',
      win: "Kapak Taurus retak dua. Sang banteng mundur dan tangga ke lantai tiga terbuka.",
      who: "Tawanan Penambang",
      say: [
        "Taurus menjaga lantai ini. Perisainya kuat menahan tebasan, tapi ia benci pecahan yang rumit.",
        "Ia paling berbahaya kalau sudah menyeruduk. Jaga jarak dan lompat!",
      ],
    },
    {
      k: "zgemini",
      n: "Gemini",
      t: "Gemini Kembar Selisih",
      el: "udara",
      weak: "arit",
      at: R_("knife", 4, "#e8eef8"),
      intro:
        'Dua bayangan berkerudung muncul bersamaan dan saling bergandengan. "Satu soal, dua jawaban. Pilih yang benar!"',
      win: "Si kembar lenyap bersama bisikan terakhir. Tangga ke lantai empat terbuka.",
      who: "Pelayan Berbisik",
      say: [
        "Dua suara selalu berbicara bergantian di lantai ini. Itu Gemini, si kembar pemegang belati.",
        "Mereka menembakkan banyak belati sekaligus. Lompatlah tepat waktu.",
      ],
    },
    {
      k: "zcancer",
      n: "Cancer",
      t: "Cancer Capit Persen",
      el: "air",
      weak: "persen",
      at: M_,
      intro:
        "Capit raksasa menjepit udara. Cancer merayap menyamping dan menutup lorong, persen demi persen.",
      win: "Cancer meringkuk ke dalam cangkangnya. Tangga ke lantai lima terbuka.",
      who: "Koki Istana",
      say: [
        "Aku sudah sepuluh tahun memasak untuk Cancer, dan masih belum tahu cara membuka cangkangnya.",
        "Cangkangnya keras, tetapi ia goyah kalau dihadapkan dengan persen.",
      ],
    },
    {
      k: "zleo",
      n: "Leo",
      t: "Leo Pedang Eksponen",
      el: "api",
      weak: "alj",
      at: R_("fire", 3, "#ffb040"),
      intro:
        'Api menyala di sepanjang bilah pedang. Leo mengaum dan surai emasnya berkobar. "Hanya yang berani boleh lewat!"',
      win: "Api Leo padam menjadi bara. Sang singa menunduk dan menyingkir dari tangga.",
      who: "Prajurit Terluka",
      say: [
        "Pedang Leo melempar gelombang api. Jangan menunggu, ia menembak tiga kali berturut-turut.",
        "Singa itu bangga, tapi aljabar membuatnya kebingungan.",
      ],
    },
    {
      k: "zvirgo",
      n: "Virgo",
      t: "Virgo Sayap Himpunan",
      el: "bumi",
      weak: "pecahan",
      at: R_("feather", 3, "#c8e8a8"),
      intro:
        'Sayap Virgo mengembang, bulu-bulunya penuh himpunan yang saling bersilangan. "Murnikan jawabanmu, atau kembalilah."',
      win: "Virgo terbang ke langit-langit dan lenyap. Tangga ke lantai tujuh terbuka.",
      who: "Peri Tersesat",
      say: [
        "Virgo dulu penjaga taman. Sekarang tamannya layu dan ia hanya menyisakan bulu-bulu tajam.",
        "Sayapnya melepas bulu seperti hujan. Hindari satu per satu.",
      ],
    },
    {
      k: "zlibra",
      n: "Libra",
      t: "Libra Timbangan Rasio",
      el: "udara",
      weak: "geom",
      at: R_("dark", 2, "#7a5aff"),
      intro:
        'Sabit Libra berayun di atas timbangan yang goyah. "Setiap jawaban punya bobot. Semoga milikmu seimbang."',
      win: "Timbangan Libra berhenti bergoyang. Ia menunduk dan menghilang ke dalam jubahnya.",
      who: "Hakim Tua",
      say: [
        "Libra menimbang semua yang lewat. Yang timpang akan dipotong sabitnya.",
        "Bentuk dan bangun menjadi keseimbangannya yang paling rapuh.",
      ],
    },
    {
      k: "zscorpio",
      n: "Scorpio",
      t: "Scorpio Sengat Variabel",
      el: "air",
      weak: "alj",
      at: R_("venom", 3, "#ff6ae0"),
      intro:
        'Capit Scorpio menyala merah muda dan ekornya melengkung tinggi. "Satu sengatan variabel, dan kamu lupa semua jawaban."',
      win: "Ekor Scorpio terkulai. Capitnya padam dan tangga ke lantai sembilan terbuka.",
      who: "Tabib Ketakutan",
      say: [
        "Sengat Scorpio meninggalkan bisa merah muda yang menyesakkan. Hati-hati dengan ekornya.",
        "Ia lemah terhadap aljabar, karena variabelnya selalu berubah.",
      ],
    },
    {
      k: "zsagit",
      n: "Sagittarius",
      t: "Sagittarius Panah Peluang",
      el: "api",
      weak: "arit",
      at: R_("knife", 4, "#ffd0a0"),
      intro:
        'Anak panah Sagittarius membidik tepat ke dahimu. "Peluang meleset satu banding tak hingga," katanya sambil menarik tali busur.',
      win: "Busur Sagittarius patah. Sang sentaur berderap pergi dan membuka jalan ke atas.",
      who: "Pemburu Buron",
      say: [
        "Sagittarius menembak empat panah sekaligus. Mereka datang rendah, jadi lompat!",
        "Ia cepat, tapi hitungan dasar membuatnya ragu.",
      ],
    },
    {
      k: "zcapri",
      n: "Capricorn",
      t: "Capricorn Ular Akar",
      el: "bumi",
      weak: "persen",
      at: M_,
      intro:
        'Capricorn menegakkan tanduknya sementara ular di sisinya mendesis. "Akar-akar angka tumbuh di bawah kakiku."',
      win: "Ular Capricorn menyusut ke dalam bayangan. Tangga ke lantai sebelas terbuka.",
      who: "Pendaki Lelah",
      say: [
        "Capricorn sudah mendaki tangga istana ini lebih lama dari siapa pun. Ia tidak pernah letih.",
        "Ularnya mendesis tiap kali ada persen yang dijawab dengan tepat.",
      ],
    },
    {
      k: "zaqua",
      n: "Aquarius",
      t: "Aquarius Kendi Desimal",
      el: "udara",
      weak: "pecahan",
      at: R_("water", 3, "#4db8ff"),
      intro:
        'Air mengucur tanpa henti dari kendi Aquarius. "Satu tetes salah, dan desimalmu hanyut."',
      win: "Kendi Aquarius kering. Roh air itu menguap menjadi kabut dan tangga terbuka.",
      who: "Tukang Kebun",
      say: [
        "Aku menyiram taman istana dengan air dari kendi Aquarius. Ia tidak pernah kering.",
        "Pecahan membuat alirannya tersendat.",
      ],
    },
    {
      k: "zpisces",
      n: "Pisces",
      t: "Pisces Trisula Logaritma",
      el: "air",
      weak: "alj",
      at: R_("ice", 3, "#7cf0ff"),
      intro:
        'Dua trisula berkilat. Pisces bernyanyi dari balik gelombang: "Hanya logaritma yang tahu dalamnya lautan."',
      win: "Trisula Pisces jatuh. Nyanyiannya memudar dan tangga ke aula takhta terbuka. Dari atas terdengar tawa dingin.",
      who: "Penyair Istana",
      say: [
        "Lantai terakhir sebelum takhta. Pisces menyanyikan lagu pengantar bagi siapa pun yang naik.",
        "Di atasnya, Ophiuchus menunggu. Isi penuh HP dan Manamu di kristal sebelum maju.",
      ],
    },
  ];
  const OPHI = {
    intro:
      'Aula bergetar. Raja Iblis Ophiuchus bangkit dari takhtanya, ular hitam melingkar di bahunya. "Dua belas penjagaku jatuh, tapi akulah bintang ketiga belas yang tidak pernah ditulis. Hitung sampai habis, Penjaga Angka!"',
    win: "Ophiuchus runtuh. Ular hitamnya larut menjadi debu bintang dan mahkotanya pecah menjadi cahaya. Istana Zodiak menjadi sunyi.",
  };

  /* ===================== SPRITE ===================== */
  Object.keys(ZSP).forEach((k) => {
    const s = ZSP[k];
    SP[k] = { p: s.p, m: s.small, a: [s.small, s.small2] };
    SP[k + "L"] = { p: s.p, m: s.big, a: [s.big, s.big2] };
  });

  /* ===================== MONSTER ===================== */
  const EI = { boss: [], oph: -1, minions: {} },
    BOSSES = new Set(),
    MT = [
      { sp: "dknight", pre: "Ksatria Iblis", hp: 1, atk: 1 },
      { sp: "gargoyle", pre: "Gargoyle", hp: 0.95, atk: 0.97 },
      { sp: "demon", pre: "Iblis", hp: 0.85, atk: 0.95 },
      { sp: "hound", pre: "Anjing Neraka", hp: 0.8, atk: 1.02 },
    ];
  SIGNS.forEach((sg, i) => {
    const f = i + 1;
    EI.boss.push(E.length);
    BOSSES.add(E.length);
    E.push({
      sp: sg.k,
      n: sg.t,
      hp: Math.round(1000 + i * 85),
      atk: Math.round(40 + i * 1.7),
      topics: ALL,
      weak: sg.weak,
      d: [4, 5],
      s: 4,
      xp: 450 + i * 55,
      coin: 700 + i * 90,
      bg: ELM[sg.el].bg,
      intro: sg.intro,
      win: sg.win,
      ...sg.at,
    });
    EI.minions[f] = [];
    if (!MINIONS) return;
    const u = i / 11;
    for (let k = 0; k < 4; k++) {
      const m = MT[(f + k) % 4],
        b =
          E.find((e) => e.sp === m.sp) ||
          E.find((e) => e.sp === "demon") ||
          E[0];
      EI.minions[f].push(E.length);
      E.push({
        ...b,
        n: `${m.pre} ${sg.n}`,
        hp: Math.round(((620 + 520 * u) * m.hp) / 5) * 5,
        atk: Math.round((33 + 16 * u) * m.atk),
        xp: Math.round(130 + 150 * u),
        coin: Math.round(110 + 150 * u),
        d: [4, 5],
        bg: ELM[sg.el].bg,
        intro: `${m.pre} ${sg.n} menghadang di lantai ${f} Istana Zodiak. Jawab dengan benar untuk lolos!`,
        win: `${m.pre} ${sg.n} tumbang. Lorong di depan terbuka lagi.`,
      });
    }
  });
  EI.oph = E.length;
  BOSSES.add(E.length);
  E.push({
    sp: "zophi",
    n: "Raja Iblis Ophiuchus",
    hp: 3200,
    atk: 68,
    topics: ALL,
    weak: "alj",
    d: [5, 5],
    s: 5,
    xp: 3000,
    coin: 6000,
    bg: ["#0c0418", "#4a1a8a", "#08020f", "#ffd24a"],
    intro: OPHI.intro,
    win: OPHI.win,
    ...R_("dark", 5, "#a24dff"),
  });

  /* ===================== PETA ===================== */
  const ID = (f) => "ZF" + f,
    FLR = {}; // id peta -> { f, foes }
  const grid = (w, h) => {
    const g = Array.from({ length: h }, () => Array(w).fill("."));
    for (let x = 0; x < w; x++) g[0][x] = g[h - 1][x] = "#";
    for (let y = 0; y < h; y++) g[y][0] = g[y][w - 1] = "#";
    return g;
  };
  const setc = (g, x, y, c) => {
    if (g[y] && g[y][x] === ".") g[y][x] = c;
  };

  // titik gerbang di aula takhta Kastil Raja Iblis (dekat Peri Cahaya)
  const dk = EN.O.find((e) => e.t === "foe" && E[e.i] && E[e.i].sp === "dking");
  let GX = 0,
    GY = 0;
  if (dk) {
    GX = dk.x + 2;
    GY = dk.y - 3;
    const r = MP.O.g[GY];
    MP.O.g[GY] = r.slice(0, GX) + "." + r.slice(GX + 1);
    EN.O.push({
      t: "portal",
      x: GX,
      y: GY,
      to: ID(1),
      tx: CX,
      ty: FH - 3,
      f: [0, -1],
      zgate: 1,
      on: () => !!F.zodiakOpen,
    });
  } else
    console.warn(
      "[istana] Raja Iblis lama tidak ditemukan; gerbang tidak dipasang.",
    );

  const chestAt = (id, x, y, f, o) => ({
    t: "chest",
    id,
    x,
    y,
    coin: 420 + f * 45,
    ...o,
  });

  SIGNS.forEach((sg, i) => {
    const f = i + 1,
      id = ID(f),
      w = FW,
      h = FH,
      g = grid(w, h),
      odd = f % 2 === 1,
      L = [2, 3, 4],
      Rr = [w - 5, w - 4, w - 3],
      wall = (y, gap) => {
        for (let x = 1; x < w - 1; x++) g[y][x] = gap.includes(x) ? "." : "#";
      };
    wall(22, odd ? L : Rr);
    wall(16, odd ? Rr : L);
    wall(10, odd ? L : Rr);
    wall(5, [CX]);
    for (let y = 1; y <= 4; y++)
      for (let x = 1; x < w - 1; x++) if (Math.abs(x - CX) >= 3) g[y][x] = "#";
    [
      [5, 24],
      [19, 24],
      [5, 26],
      [19, 26],
      [6, 18],
      [18, 18],
      [6, 20],
      [18, 20],
      [6, 12],
      [18, 12],
      [6, 14],
      [18, 14],
      [5, 7],
      [19, 7],
      [9, 8],
      [15, 8],
    ].forEach(([x, y]) => setc(g, x, y, "Y"));
    [
      [CX - 2, 6],
      [CX + 2, 6],
      [CX - 2, 2],
      [CX + 2, 2],
    ].forEach(([x, y]) => setc(g, x, y, "y"));
    for (let y = 1; y <= 27; y++)
      if ((y <= 5 || (y >= 6 && y <= 9) || y >= 23) && g[y][CX] === ".")
        g[y][CX] = "1";
    g[5][CX] = "1";

    const ents = [
      {
        t: "portal",
        x: CX,
        y: h - 2,
        stair: "dn",
        ...(f === 1
          ? { to: "O", tx: GX, ty: GY + 1, f: [0, 1] }
          : { to: ID(f - 1), tx: CX, ty: 2, f: [0, 1] }),
      },
      {
        t: "portal",
        x: CX,
        y: 1,
        stair: "up",
        ...(f === 12
          ? { to: "ZT", tx: 10, ty: TH_ - 3, f: [0, -1] }
          : { to: ID(f + 1), tx: CX, ty: h - 3, f: [0, -1] }),
      },
      { t: "crystal", x: 17, y: 7 },
      chestAt(`zc${f}a`, odd ? 23 : 1, 18, f, { po: 1, fp: f % 2 }),
      chestAt(`zc${f}b`, odd ? 1 : 23, 13, f, {
        po: 1,
        sc: f % 3 === 0 ? 1 : 0,
      }),
      { t: "npc", id: "zn" + f, x: CX + 3, y: 25, sp: "prajurit" },
      { t: "foe", i: EI.boss[i], x: CX, y: 5, sp: sg.k, big: 1 },
    ];
    const mi = EI.minions[f];
    if (mi.length) {
      const spots = [
        [CX, 19],
        [8, 13],
        [16, 13],
        [CX, 7],
      ];
      mi.forEach((idx, k) =>
        ents.push({
          t: "foe",
          i: idx,
          x: spots[k][0],
          y: spots[k][1],
          sp: E[idx].sp,
        }),
      );
    }
    N["zn" + f] = () =>
      dlg(sg.who, [
        ...sg.say,
        `Penjaga lantai ini: ${sg.t}. Ia lemah terhadap ${TN[sg.weak]}.`,
      ]);

    MP[id] = { th: ELM[sg.el].th, w, h, g: g.map((r) => r.join("")) };
    EN[id] = ents;
    MN[id] = `Istana Zodiak · Lt.${f} ${sg.n}`;
    FLR[id] = { f, foes: mi.slice(), sg };
  });

  // aula takhta Ophiuchus
  {
    const w = TW,
      h = TH_,
      g = grid(w, h);
    [
      [3, 5],
      [17, 5],
      [3, 9],
      [17, 9],
      [3, 13],
      [17, 13],
      [7, 7],
      [13, 7],
    ].forEach(([x, y]) => setc(g, x, y, "Y"));
    [
      [8, 2],
      [12, 2],
      [2, 16],
      [18, 16],
      [6, 16],
      [14, 16],
    ].forEach(([x, y]) => setc(g, x, y, "y"));
    for (let y = 1; y <= 17; y++) if (g[y][10] === ".") g[y][10] = "1";
    MP.ZT = { th: "zt", w, h, g: g.map((r) => r.join("")) };
    EN.ZT = [
      {
        t: "portal",
        x: 10,
        y: h - 2,
        stair: "dn",
        to: ID(12),
        tx: CX,
        ty: 2,
        f: [0, 1],
      },
      { t: "crystal", x: 4, y: 15 },
      { t: "foe", i: EI.oph, x: 10, y: 4, sp: "zophi", big: 2 },
      ...[
        [2, 2],
        [18, 2],
        [2, 8],
      ].map(([x, y], k) => ({
        ...chestAt("zt" + k, x, y, 12, { po: 1, fp: 1, sc: k === 2 ? 1 : 0 }),
        coin: 1500 + k * 500,
        on: () => !!F.done[EI.oph],
      })),
    ];
    MN.ZT = "Aula Raja Iblis Ophiuchus";
  }
  const ZMAP = (id) => id === "ZT" || !!FLR[id];

  /* ===================== TAMPILAN PETAK ===================== */
  TILEX += "Yy1";
  {
    const _tx = tileX;
    tileX = function (c, X, Y, x, y, th, t) {
      if (!"Yy1".includes(c) || !ACC[th]) return _tx(c, X, Y, x, y, th, t);
      const fl = (col, a, b, ww, hh) => {
          ctx.fillStyle = col;
          ctx.fillRect(X + a, Y + b, ww, hh);
        },
        ac = ACC[th];
      if (c === "Y") {
        fl("rgba(0,0,0,.3)", 1, 14, 15, 2);
        fl("#3e3a56", 2, 12, 12, 3);
        fl("#6e6a90", 4, 3, 8, 10);
        fl("#a8a4cc", 4, 3, 3, 10);
        fl("#4a4668", 10, 3, 2, 10);
        fl(ac, 3, 1, 10, 3);
        fl("rgba(255,255,255,.35)", 3, 1, 10, 1);
        fl(ac, 3, 12, 10, 1);
      } else if (c === "y") {
        fl("rgba(0,0,0,.3)", 3, 14, 11, 2);
        fl("#14101e", 5, 12, 6, 3);
        fl("#2a2638", 4, 9, 8, 4);
        fl("#4a4660", 3, 8, 10, 2);
        const k = rm ? 0 : Math.round(Math.sin(t / 110 + x * 2)),
          hh = 4 + k;
        ctx.globalAlpha = 0.18 + (rm ? 0 : 0.08 * Math.sin(t / 200 + x));
        fl(ac, -3, -3, 22, 22);
        ctx.globalAlpha = 1;
        fl(ac, 5, 8 - hh, 6, hh);
        fl("#fff3c0", 6, 8 - hh + 2, 4, hh - 2);
        fl(ac, 7, 8 - hh - 2, 2, 2);
      } else {
        fl(CAR[th], 2, 0, 12, 16);
        fl("#e2b84a", 2, 0, 1, 16);
        fl("#e2b84a", 13, 0, 1, 16);
        fl("rgba(0,0,0,.2)", 3, 0, 1, 16);
        fl("rgba(255,255,255,.12)", 5, (y % 2) * 8, 6, 3);
        fl("#e2b84a", 7, 4 + (y % 2) * 8, 2, 2);
      }
    };
    const _bd = baseDeco;
    baseDeco = function (th, X, Y, x, y) {
      if (!ACC[th]) return _bd(th, X, Y, x, y);
      ctx.fillStyle = "rgba(0,0,0,.12)";
      ctx.fillRect(X, Y + 15, 16, 1);
      ctx.fillRect(X + 15, Y, 1, 16);
      if ((x * 7 + y * 11) % 17 === 0) {
        ctx.globalAlpha = rm
          ? 0.5
          : 0.25 + 0.3 * Math.sin(performance.now() / 500 + x * 3 + y);
        ctx.fillStyle = ACC[th];
        ctx.fillRect(X + 4 + ((x * 3) % 7), Y + 5 + ((y * 5) % 6), 2, 2);
        ctx.globalAlpha = 1;
      }
    };
    const _solid = solid;
    solid = (x, y) =>
      _solid(x, y) ||
      (ZMAP(mp) && "Yy".includes((MP[mp].g[y] || "")[x] || " "));
  }

  /* ===== bos dan Ophiuchus digambar besar di peta; gerbang istana digambar khusus ===== */
  {
    const _ent = ent;
    ent = function (e, t, bob) {
      const X = e.x * 16,
        Y = e.y * 16 + OY;
      if (e.zgate) {
        ctx.globalAlpha = 0.16 + (rm ? 0 : 0.1 * Math.sin(t / 260));
        ctx.fillStyle = "#a24dff";
        ctx.fillRect(X - 4, Y - 4, 24, 24);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#0a0414";
        ctx.fillRect(X + 1, Y, 14, 16);
        ctx.fillStyle = "#e2b84a";
        ctx.fillRect(X, Y, 16, 2);
        ctx.fillRect(X, Y, 2, 16);
        ctx.fillRect(X + 14, Y, 2, 16);
        ctx.fillStyle = "#a24dff";
        for (let i = 0; i < 6; i++) {
          const a = (rm ? 0 : t / 320) + i * 1.05,
            r = 2 + (i % 3) * 1.7;
          ctx.fillRect(
            Math.round(X + 8 + Math.cos(a) * r * 1.5),
            Math.round(Y + 9 + Math.sin(a) * r * 2),
            2,
            2,
          );
        }
        ctx.fillStyle = "#ffd24a";
        ctx.fillRect(X + 7, Y + 7, 2, 2);
        return;
      }
      if (e.big && e.t === "foe") {
        const s = e.big,
          so = SP[e.sp + "L"],
          fm = so.a[rm ? 0 : (Math.floor(t / 420) + e.x) % 2];
        ctx.fillStyle = "#000";
        ctx.globalAlpha = 0.3;
        ctx.fillRect(X - 6 * s, Y + 13, 12 + 16 * s, 3);
        ctx.globalAlpha = 1;
        spr(
          e.sp + "L",
          X + 8 - 16 * s,
          Y + 16 - 32 * s + bob,
          s,
          1,
          null,
          0,
          0,
          fm,
        );
        return;
      }
      _ent(e, t, bob);
    };
  }

  /* ===================== MUSIK ===================== */
  {
    const _m = SND.music;
    SND.music = function (n) {
      return _m.call(SND, n === "ZT" ? "boss" : FLR[n] ? "Z" : n);
    };
    const _st = start;
    start = function (i) {
      _st(i);
      if (BOSSES.has(i)) SND.music("boss");
    };
  }

  /* ===================== QUEST & CERITA ===================== */
  EQ.ophisword = {
    n: "Pedang Ophiuchus",
    s: "w",
    atk: 22,
    pen: 8,
    fist: "#c99aff",
    sw: "#efe0ff",
  };
  const nBoss = () => EI.boss.filter((i) => F.done[i]).length;
  QS.push({
    id: "zodiak",
    n: "Istana Zodiak",
    d: "Masuki gerbang di aula takhta Kastil Raja Iblis, naiki 12 lantai yang dijaga 12 bintang zodiak, lalu kalahkan Raja Iblis Ophiuchus di puncaknya.",
    gp: 400,
    coin: 6000,
    it: "ophisword",
    on: () => !!F.zodiakOpen,
    chk: () => F.zodiakOk,
    pr: () =>
      F.done[EI.oph]
        ? "Raja Iblis sudah kalah. Kembali ke Guild"
        : `Penjaga zodiak ${nBoss()}/12 dikalahkan`,
  });

  // Peri Cahaya membuka gerbang Istana Zodiak
  {
    const _peri = N.peri;
    const reveal = [
      "Tapi tunggu. Raja Iblis Tak Hingga hanyalah bayangan dari penguasa yang sebenarnya.",
      "Di balik aula ini terbuka gerbang menuju Istana Zodiak. Dua belas lantai dijaga dua belas bintang, dan di puncaknya duduk Ophiuchus, bintang ketiga belas yang dibuang dari langit.",
      "Gerbangnya sudah bercahaya di dekatku. Isi penuh HP dan Manamu, lalu naiklah, Penjaga Angka.",
    ];
    N.peri = () => {
      if (!F.iblisOk) {
        F.iblisOk = F.zodiakOpen = 1;
        SND.sfx("win");
        return dlg(
          "Peri Cahaya",
          [
            "Kamu mengalahkan Raja Iblis Tak Hingga! Sudah ratusan tahun angka-angka di benua ini terkurung di mahkotanya.",
            "Lihat, cahaya mulai kembali ke tanah ini. Terima kasih, Penjaga Angka.",
            ...reveal,
            "Setelah itu, kembalilah ke Guild dan klaim hadiahmu di Papan Quest.",
          ],
          () => {
            hud();
            idle();
            say(
              "Gerbang Istana Zodiak terbuka di aula takhta. Klaim juga hadiah 'Benua Iblis' di Papan Quest.",
            );
          },
        );
      }
      if (!F.zodiakOpen) {
        F.zodiakOpen = 1;
        SND.sfx("quest");
        return dlg("Peri Cahaya", reveal, () => {
          hud();
          idle();
          say("Gerbang Istana Zodiak terbuka di aula takhta, di dekat Peri.");
        });
      }
      if (F.zodiakOk)
        return dlg("Peri Cahaya", [
          "Ophiuchus sudah tiada. Bintang-bintang kembali ke tempatnya, dan angka-angka kembali bernyanyi.",
        ]);
      dlg("Peri Cahaya", [
        "Gerbang Istana Zodiak ada di dekat sini. Dua belas lantai, dua belas penjaga. Kristal di tiap lantai bisa memulihkanmu.",
      ]);
    };
  }

  /* ===================== PERILAKU ===================== */
  {
    // monster biasa muncul lagi tiap masuk lantai; info lantai
    const _p = H.portal;
    H.portal = (e) => {
      const m = FLR[e.to];
      if (m) m.foes.forEach((i) => delete F.done[i]);
      _p(e);
      if (m)
        say(
          `Istana Zodiak · Lantai ${m.f}/12. Penjaga: ${m.sg.t}. Lemah terhadap ${TN[m.sg.weak]}.`,
        );
      else if (e.to === "ZT")
        say(
          "Aula Raja Iblis Ophiuchus. Isi penuh HP dan Manamu di kristal sebelum maju.",
        );
    };
    // hadiah tambahan dari bos
    const _w = win;
    win = function () {
      _w();
      if (!S || !BOSSES.has(S.i)) return;
      const big = S.i === EI.oph;
      Pl.pot += big ? 5 : 2;
      Pl.fpot += big ? 3 : 1;
      const row = document.querySelector("#ui .card .row");
      if (row)
        row.insertAdjacentHTML(
          "beforebegin",
          `<div class="ok" style="margin-top:6px">Item jatuh: ${big ? 5 : 2} Ramuan HP, ${big ? 3 : 1} Ramuan Mana</div>`,
        );
    };
    // setelah Ophiuchus kalah
    const _bk = W.back;
    W.back = function (i) {
      _bk(i);
      if (i === EI.oph && !F.zodiakOk)
        dlg(
          "Peri Cahaya",
          [
            "Ophiuchus telah tumbang. Dua belas bintang kembali ke langit, dan bintang ketiga belas akhirnya dikenang, bukan dibuang.",
            "Terima kasih, Penjaga Angka. Kembalilah ke Guild dan klaim hadiah 'Istana Zodiak' di Papan Quest.",
          ],
          () => {
            F.zodiakOk = 1;
            SND.sfx("win");
            hud();
            idle();
            say(
              "Misi Istana Zodiak selesai. Klaim hadiahnya di Papan Quest Guild.",
            );
          },
        );
    };
  }
})();
