// api/index.js
async function generateStatsSVG(req, res) {
  const queryParams = req.query || {};
  const { username = 'octocat', theme = 'light', lang = 'en' } = queryParams;

  const color = theme === 'dark' ? '#E0E0E0' : '#333';
  const bg = theme === 'dark' ? '#121212' : '#FFFEFE';
  const borderColor = theme === 'dark' ? '#555' : '#E0E0E0';

  const translations = {
    en: {
      title: "GitHub Stats",
      repos: "Repos",
      followers: "Followers",
      userNotFound: "User Not Found",
      errorFetching: "Error Fetching Data",
      tryAgain: "Please try again later."
    },
    fa: {
      title: "آمار گیت‌هاب",
      repos: "ریپازیتوری‌ها",
      followers: "دنبال‌کنندگان",
      userNotFound: "کاربر یافت نشد",
      errorFetching: "خطا در دریافت اطلاعات",
      tryAgain: "لطفاً بعداً تلاش کنید."
    }
  };
  const t = translations[lang] || translations['en'];

  let svg;

  try {
    const githubApiResponse = await fetch(`https://api.github.com/users/${username}`);
    
    if (!githubApiResponse.ok) {
      const errorData = await githubApiResponse.json().catch(() => ({ message: t.errorFetching }));
      if (githubApiResponse.status === 404) {
        svg = generateErrorSVG(t.userNotFound, `Username: ${username}`, bg, color, borderColor);
      } else {
        svg = generateErrorSVG(t.errorFetching, errorData.message || t.tryAgain, bg, color, borderColor);
      }
    } else {
      const data = await githubApiResponse.json();

      if (!data.login) {
        svg = generateErrorSVG(t.userNotFound, `Username: ${username}`, bg, color, borderColor);
      } else {
        svg = `
          <svg width="400" height="150" xmlns="http://www.w3.org/2000/svg">
            <style>
              .header { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${color}; }
              .stat { font: 400 14px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: ${color}; }
            </style>
            <rect
              data-testid="card-bg"
              x="0.5"
              y="0.5"
              rx="4.5"
              height="99%"
              stroke="${borderColor}"
              width="399"
              fill="${bg}"
              stroke-opacity="1"
            />
            <text x="25" y="35" class="header">${data.login}'s ${t.title}</text>
            
            <text x="25" y="70" class="stat">${t.repos}: ${data.public_repos !== undefined ? data.public_repos : 'N/A'}</text>
            <text x="25" y="95" class="stat">${t.followers}: ${data.followers !== undefined ? data.followers : 'N/A'}</text>
            <svg x="350" y="20" width="24" height="24" viewBox="0 0 16 16" fill="${color}" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
          </svg>
        `;
      }
    }
  } catch (error) {
    console.error('Error in handler:', error);
    svg = generateErrorSVG(t.errorFetching, t.tryAgain, bg, color, borderColor);
  }

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.writeHead(200);
  res.end(svg);
}

function generateErrorSVG(title, message, bg, color, borderColor) {
  return `
    <svg width="400" height="120" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${color}; }
        .message { font: 400 14px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: ${color}; }
      </style>
      <rect
        x="0.5"
        y="0.5"
        rx="4.5"
        height="99%"
        stroke="${borderColor}"
        width="399"
        fill="${bg}"
        stroke-opacity="1"
      />
      <text x="25" y="45" class="title">${title}</text>
      <text x="25" y="75" class="message">${message}</text>
    </svg>
  `;
}

module.exports = { generateStatsSVG };
