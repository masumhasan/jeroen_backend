const { OpenAI } = require('openai');

let _openai;
const getOpenAIClient = () => {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
};

/**
 * Generate nutritional recommendations using OpenAI
 * @param {Object} userProfile - User profile data (age, gender, height, weight, activityLevel, goal)
 * @returns {Promise<Object>} - Object containing recommendedCalories, protein, carbs, and fat
 */
const generateRecommendations = async (userProfile) => {
  const openai = getOpenAIClient();
  const { firstName, age, gender, height, weight, activityLevel, goal } = userProfile;

  const prompt = `
    You are a professional nutritionist. Calculate the daily nutritional requirements for a user based on the following profile:
    - Name: ${firstName}
    - Age: ${age}
    - Gender: ${gender}
    - Height: ${height} cm
    - Weight: ${weight} kg
    - Activity Level: ${activityLevel}
    - Goal: ${goal}

    Please provide the following data in a clean JSON format:
    1. Recommended total calories per day (calories)
    2. Protein in grams (protein)
    3. Carbohydrates in grams (carbs)
    4. Fats in grams (fat)

    Format your response EXACTLY like this:
    {
      "recommendedCalories": 2400,
      "recommendedProtein": 150,
      "recommendedCarbs": 225,
      "recommendedFat": 50
    }
    Return ONLY the JSON.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const recommendations = JSON.parse(response.choices[0].message.content);
    return recommendations;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    // Fallback logic if AI fails (basic BMR calculation)
    return calculateBasicBMR(userProfile);
  }
};

/**
 * Fallback calculation using Harris-Benedict Equation
 */
const calculateBasicBMR = (userProfile) => {
  const { age, gender, height, weight, activityLevel, goal } = userProfile;
  
  let bmr;
  if (gender === 'Male') {
    bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
  } else {
    bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
  }

  const activityMultipliers = {
    'Sedentary': 1.2,
    'Moderate': 1.55,
    'Active': 1.725,
    'Very Active': 1.9
  };

  let tdee = bmr * (activityMultipliers[activityLevel] || 1.2);

  // Adjust based on goal
  if (goal === 'Weight Loss') tdee -= 500;
  if (goal === 'Weight Gain' || goal === 'Muscle Gain') tdee += 500;

  const calories = Math.round(tdee);
  
  // Basic macro split (40/30/30)
  return {
    recommendedCalories: calories,
    recommendedProtein: Math.round((calories * 0.3) / 4),
    recommendedCarbs: Math.round((calories * 0.4) / 4),
    recommendedFat: Math.round((calories * 0.3) / 9)
  };
};

module.exports = {
  generateRecommendations,
};
