// api/index.js

// Helper function to fetch and cache GitHub API data
async function fetchGitHubData(url, cache, cacheKey, cacheTTL = 3600 * 1000) { // 1 hour TTL
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < cacheTTL)) {
    return cached.data;
  }

  try {
    const response = await fetch(url, {
      headers: {
        // 'Authorization': `token YOUR_GITHUB_TOKEN` // برای افزایش rate limit در صورت نیاز
        'User-Agent': 'Readme-Stats-Pro-NodeJS'
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitHub API Error for ${url}: ${response.status} ${errorText}`);
      // Return a specific error object or throw, to be handled by the caller
      return { error: true, status: response.status, message: `GitHub API Error: ${response.status}` };
    }
    const data = await response.json();
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`Network or parsing error for ${url}:`, error);
    return { error: true, status: 500, message: 'Failed to fetch data from GitHub' };
  }
}

async function getAvatarBase64(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:${response.headers.get('content-type')};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error fetching avatar:', error);
    return null;
  }
}

async function generateStatsSVG(req, res, caches) {
  const queryParams = req.query || {};
  const {
    username = 'octocat',
    theme = 'light',
    lang = 'en',
    color: customColor,
    bg: customBg,
    border: customBorder,
    width: customWidth,
    height: customHeight,
    hide_avatar: hideAvatarParam, // پارامتر برای مخفی کردن آواتار
    hide_languages: hideLanguagesParam // پارامتر برای مخفی کردن زبان‌ها
  } = queryParams;

  const showAvatar = hideAvatarParam !== 'true';
  const showLanguages = hideLanguagesParam !== 'true';

  // --- اندازه کارت ---
  let cardWidth = parseInt(customWidth, 10) || 450; // افزایش عرض پیش‌فرض
  let cardHeight = parseInt(customHeight, 10) || 185; // افزایش ارتفاع پیش‌فرض
  cardWidth = Math.max(300, Math.min(1000, cardWidth)); // محدودیت عرض
  cardHeight = Math.max(150, Math.min(800, cardHeight));

  // --- رنگ‌ها ---
  const themes = {
    light: { color: '#333', bg: '#FFFEFE', border: '#E0E0E0', avatarBorder: '#D0D0D0' },
    dark: { color: '#E0E0E0', bg: '#121212', border: '#555', avatarBorder: '#666' }
  };
  const currentTheme = themes[theme] || themes.light;

  const finalColors = {
    text: customColor || currentTheme.color,
    background: customBg || currentTheme.bg,
    border: customBorder || currentTheme.border,
    avatarBorder: customBorder || currentTheme.avatarBorder // آواتار هم می‌تواند رنگ بردر سفارشی بگیرد
  };

  // --- ترجمه‌ها ---
  const translations = {
    en: { title: "GitHub Stats", repos: "Repos", followers: "Followers", languages: "Top Languages", userNotFound: "User Not Found", errorFetching: "Error Fetching Data", tryAgain: "Please try again later." },
    fa: { title: "آمار گیت‌هاب", repos: "ریپازیتوری‌ها", followers: "دنبال‌کنندگان", languages: "زبان‌های برتر", userNotFound: "کاربر یافت نشد", errorFetching: "خطا در دریافت اطلاعات", tryAgain: "لطفاً بعداً تلاش کنید." },
    de: { title: "GitHub-Statistiken", repos: "Repos", followers: "Follower", languages: "Top-Sprachen", userNotFound: "Benutzer nicht gefunden", errorFetching: "Fehler beim Abrufen der Daten", tryAgain: "Bitte später erneut versuchen." },
    es: { title: "Estadísticas de GitHub", repos: "Repos", followers: "Seguidores", languages: "Lenguajes Principales", userNotFound: "Usuario no encontrado", errorFetching: "Error al obtener datos", tryAgain: "Por favor, inténtalo de nuevo más tarde." },
    tr: { title: "GitHub İstatistikleri", repos: "Repolar", followers: "Takipçiler", languages: "En Popüler Diller", userNotFound: "Kullanıcı Bulunamadı", errorFetching: "Veri Alınırken Hata Oluştu", tryAgain: "Lütfen daha sonra tekrar deneyin." }
  };
  const t = translations[lang] || translations.en;

  let svg;
  let avatarBase64 = null;
  let topLanguages = [];

  try {
    // 1. Fetch User Data
    const userDataUrl = `https://api.github.com/users/${username}`;
    const userData = await fetchGitHubData(userDataUrl, caches.apiCache, `user:${username}`);

    if (userData.error || !userData.login) {
      const message = userData.status === 404 ? t.userNotFound : (userData.message || t.errorFetching);
      svg = generateErrorSVG(message, `Username: ${username}`, finalColors, cardWidth, 120);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120'); // Cache کوتاه برای خطا
      res.writeHead(userData.status === 404 ? 404 : 500);
      return res.end(svg);
    }

    // 2. Fetch Avatar (if shown)
    if (showAvatar && userData.avatar_url) {
      avatarBase64 = await getAvatarBase64(userData.avatar_url);
    }
    
    // 3. Fetch Repos and Calculate Top Languages (if shown)
    if (showLanguages) {
      const reposUrl = `https://api.github.com/users/${username}/repos?per_page=100`; // Fetch up to 100 repos
      const reposData = await fetchGitHubData(reposUrl, caches.reposCache, `repos:${username}`);

      if (reposData && !reposData.error && Array.isArray(reposData)) {
        const langStats = reposData.reduce((acc, repo) => {
          if (repo.language) {
            acc[repo.language] = (acc[repo.language] || 0) + 1;
          }
          return acc;
        }, {});
        topLanguages = Object.entries(langStats)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3) // Top 3 languages
          .map(([name, count]) => ({ name, count }));
      }
    }

    // تنظیم ارتفاع کارت بر اساس محتوا
    let dynamicHeight = 140; // ارتفاع پایه برای نام و آمار اصلی
    if (showAvatar) dynamicHeight = Math.max(dynamicHeight, 150); // کمی فضا برای آواتار
    if (showLanguages && topLanguages.length > 0) {
        dynamicHeight += 25 + (topLanguages.length * 20); // فضا برای عنوان زبان‌ها و لیست
    }
    cardHeight = parseInt(customHeight, 10) || dynamicHeight;
    cardHeight = Math.max(150, Math.min(800, cardHeight));


    // --- SVG Generation ---
    const padding = 20;
    const avatarSize = showAvatar ? 60 : 0;
    const avatarX = cardWidth - padding - avatarSize;
    const avatarY = padding;

    let statsX = padding;
    let textAnchor = "start";
    
    if (showAvatar && avatarBase64) {
        statsX = padding; // آمار همچنان از چپ شروع می‌شود
    }

    svg = `
      <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <style>
          .bg { fill: ${finalColors.background}; stroke: ${finalColors.border}; stroke-width: 1.5; }
          .header { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${finalColors.text}; }
          .stat-label { font: 500 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${finalColors.text}; }
          .stat-value { font: 700 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${finalColors.text}; }
          .lang-label { font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${finalColors.text}; }
          .error-title { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${finalColors.text}; }
          .error-message { font: 400 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${finalColors.text}; }
        </style>
        <rect data-testid="card-bg" class="bg" x="0.5" y="0.5" rx="4.5" height="${cardHeight - 1}" width="${cardWidth - 1}" />
        
        ${showAvatar && avatarBase64 ? `
          <defs>
            <clipPath id="avatarClip">
              <circle cx="${avatarX + avatarSize / 2}" cy="${avatarY + avatarSize / 2}" r="${avatarSize / 2}" />
            </clipPath>
          </defs>
          <image xlink:href="${avatarBase64}" x="${avatarX}" y="${avatarY}" height="${avatarSize}" width="${avatarSize}" clip-path="url(#avatarClip)" />
          <circle cx="${avatarX + avatarSize / 2}" cy="${avatarY + avatarSize / 2}" r="${avatarSize / 2}" fill="none" stroke="${finalColors.avatarBorder}" stroke-width="2"/>
        ` : ''}

        <text x="${statsX}" y="${padding + 20}" class="header" text-anchor="${textAnchor}">${userData.login || username}</text>
        <text x="${statsX}" y="${padding + 45}" class="stat-label" text-anchor="${textAnchor}">${t.repos}: <tspan class="stat-value">${userData.public_repos !== undefined ? userData.public_repos : 'N/A'}</tspan></text>
        <text x="${statsX}" y="${padding + 70}" class="stat-label" text-anchor="${textAnchor}">${t.followers}: <tspan class="stat-value">${userData.followers !== undefined ? userData.followers : 'N/A'}</tspan></text>
        
        ${showLanguages && topLanguages.length > 0 ? `
          <text x="${statsX}" y="${padding + 105}" class="stat-label" text-anchor="${textAnchor}">${t.languages}:</text>
          ${topLanguages.map((lang, index) => `
            <text x="${statsX + 10}" y="${padding + 105 + (index + 1) * 20}" class="lang-label" text-anchor="${textAnchor}">- ${lang.name} (${lang.count})</text>
          `).join('')}
        ` : ''}
      </svg>
    `;

  } catch (error) {
    console.error('Error in generateStatsSVG main try-catch:', error);
    svg = generateErrorSVG(t.errorFetching, t.tryAgain, finalColors, cardWidth, 120);
  }

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400'); // کش 1 ساعته، با اعتبارسنجی مجدد تا 1 روز
  res.writeHead(200);
  res.end(svg);
}

function generateErrorSVG(title, message, colors, width, height) {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .bg { fill: ${colors.background}; stroke: ${colors.border}; stroke-width: 1.5; }
        .error-title { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${colors.text}; }
        .error-message { font: 400 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${colors.text}; }
      </style>
      <rect class="bg" x="0.5" y="0.5" rx="4.5" height="${height - 1}" width="${width - 1}" />
      <text x="25" y="45" class="error-title">${title}</text>
      <text x="25" y="75" class="error-message">${message}</text>
    </svg>
  `;
}

module.exports = { generateStatsSVG };
