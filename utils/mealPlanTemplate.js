/**
 * Generates styled HTML from structured meal plan data.
 * Used for both image generation (node-html-to-image) and storage.
 */
function buildMealPlanHtml(mealPlanData) {
  const { day, targetCalories, meals = [], totalCalories, totalProtein, totalCarbs, totalFat } = mealPlanData;

  const mealRows = meals
    .map(
      (m) => `
      <tr>
        <td style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:#6B7280;font-weight:600;width:90px;vertical-align:top;">
          ${escapeHtml(m.mealType || '')}
        </td>
        <td style="padding:10px 12px;">
          <div style="font-weight:600;font-size:14px;color:#1F2937;">${escapeHtml(m.name || '')}</div>
          <div style="font-size:12px;color:#6B7280;margin-top:3px;">
            P: ${m.protein || 0}g &nbsp; C: ${m.carbs || 0}g &nbsp; F: ${m.fat || 0}g
          </div>
        </td>
        <td style="padding:10px 12px;text-align:right;font-weight:600;font-size:14px;color:#374151;white-space:nowrap;">
          ${m.calories || 0} <span style="font-size:11px;color:#9CA3AF;">kcal</span>
        </td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #F9FAFB;
      padding: 24px;
      width: 420px;
    }
    .card {
      background: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .header {
      background: #89957F;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-title {
      color: #FFFFFF;
      font-size: 16px;
      font-weight: 700;
    }
    .header-cal {
      color: rgba(255,255,255,0.85);
      font-size: 13px;
      font-weight: 500;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    tr:not(:last-child) td {
      border-bottom: 1px solid #F3F4F6;
    }
    .totals {
      background: #F9FAFB;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 2px solid #E5E7EB;
    }
    .totals-label {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
    }
    .totals-macros {
      font-size: 12px;
      color: #6B7280;
    }
    .totals-cal {
      font-size: 16px;
      font-weight: 700;
      color: #89957F;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="header-title">${escapeHtml(day || 'Daily')} Meal Plan</span>
      <span class="header-cal">Target: ${targetCalories || 0} kcal</span>
    </div>
    <table>
      ${mealRows}
    </table>
    <div class="totals">
      <div>
        <div class="totals-label">Total</div>
        <div class="totals-macros">P: ${totalProtein || 0}g &nbsp; C: ${totalCarbs || 0}g &nbsp; F: ${totalFat || 0}g</div>
      </div>
      <div class="totals-cal">${totalCalories || 0} kcal</div>
    </div>
  </div>
</body>
</html>`;

  return html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { buildMealPlanHtml };
