require('dotenv').config();
const axios = require('axios');
const readline = require('readline-sync');

// Try multiple models in case one is not available
const MODELS = [
  "cardiffnlp/twitter-roberta-base-sentiment-latest",
  "distilbert-base-uncased-finetuned-sst-2-english", 
  "cardiffnlp/twitter-roberta-base-sentiment",
  "nlptown/bert-base-multilingual-uncased-sentiment"
];

const TOKEN = process.env.HUGGINGFACE_TOKEN;
console.log("token: ",TOKEN);

async function testModel(modelName, text) {
  const API_URL = `https://api-inference.huggingface.co/models/${modelName}`;
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json"
  };

  try {
    const response = await axios.post(API_URL, {
      inputs: text
    }, { 
      headers,
      timeout: 30000 // 30 second timeout
    });
    
    return { success: true, data: response.data, model: modelName };
  } catch (error) {
    return { 
      success: false, 
      error: error.response ? 
        `${error.response.status}: ${JSON.stringify(error.response.data)}` : 
        error.message,
      model: modelName 
    };
  }
}

async function analyzeSentiment(text) {
  console.log("🔄 Analyzing sentiment...");
  
  // Try each model until one works
  for (const model of MODELS) {
    console.log(`🔍 Trying model: ${model}`);
    
    const result = await testModel(model, text);
    
    if (result.success) {
      console.log(`✅ Success with model: ${model}`);
      console.log(`\n📊 Sentiment Result for: "${text}"`);
      
      // Handle different response formats
      if (Array.isArray(result.data) && result.data.length > 0) {
        const data = result.data[0];
        
        if (Array.isArray(data)) {
          // Standard classification response
          data.forEach(item => {
            const label = item.label.replace('LABEL_', '').replace('_', ' ');
            console.log(` - ${label}: ${(item.score * 100).toFixed(2)}%`);
          });
        } else {
          // Alternative response format
          console.log(` - Result: ${JSON.stringify(data, null, 2)}`);
        }
      } else {
        console.log(` - Raw response: ${JSON.stringify(result.data, null, 2)}`);
      }
      return; // Exit after successful analysis
    } else {
      console.log(`❌ Failed with ${model}: ${result.error}`);
      
      // If it's a 503 error (model loading), wait and retry
      if (result.error.includes('503')) {
        console.log("⏳ Model is loading, waiting 10 seconds...");
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const retryResult = await testModel(model, text);
        if (retryResult.success) {
          console.log(`✅ Success with model after retry: ${model}`);
          console.log(`\n📊 Sentiment Result for: "${text}"`);
          
          if (Array.isArray(retryResult.data) && retryResult.data.length > 0) {
            const data = retryResult.data[0];
            if (Array.isArray(data)) {
              data.forEach(item => {
                const label = item.label.replace('LABEL_', '').replace('_', ' ');
                console.log(` - ${label}: ${(item.score * 100).toFixed(2)}%`);
              });
            }
          }
          return;
        }
      }
    }
  }
  
  console.error("❌ All models failed. Please check your internet connection and API token.");
}

async function validateToken() {
  try {
    const response = await axios.get('https://huggingface.co/api/whoami', {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log(`✅ Token valid for user: ${response.data.name}`);
    return true;
  } catch (error) {
    console.error("❌ Token validation failed:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`Error: ${error.message}`);
    }
    console.log("⚠️ Proceeding anyway to test the inference API directly...");
    return true; // Let's proceed anyway and test the actual API
  }
}

async function main() {
  console.log("🤖 AI Sentiment Analysis Tool");
  console.log("===============================");
  
  // Check if token is configured
  if (!TOKEN) {
    console.error("❌ Error: HUGGINGFACE_TOKEN not found in .env file");
    console.log("Please add your Hugging Face token to the .env file:");
    console.log("HUGGINGFACE_TOKEN=your_token_here");
    return;
  }
  
  // Validate token
  console.log("🔐 Validating API token...");
  const isValidToken = await validateToken();
  if (!isValidToken) {
    return;
  }
  
  // Test with a simple sentence first
  console.log("🧪 Testing API with a simple sentence...");
  await analyzeSentiment("I love this!");
  
  while (true) {
    const input = readline.question("\n🗣️ Enter a sentence to analyze sentiment (or 'quit' to exit): ");
    
    if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
      console.log("👋 Goodbye!");
      break;
    }
    
    if (input.trim() === '') {
      console.log("⚠️ Please enter a valid sentence.");
      continue;
    }
    
    await analyzeSentiment(input);
  }
}

main().catch(console.error);
