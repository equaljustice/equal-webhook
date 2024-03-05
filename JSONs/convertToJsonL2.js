import fs from 'fs';

// Read the text file
const data = fs.readFileSync('QnATraining.txt', 'utf8');

// Split the data into question-answer pairs
const pairs = data.split('\nQuestion: ');

// Remove the first empty element
pairs.shift();

// Create an array to store the JSONL objects
const jsonlArray = [];

// Loop through each question-answer pair
for (const pair of pairs) {
    // Extract question and answer
    const [question, answer] = pair.split('\nAnswer: ');

    // Remove leading and trailing whitespaces
    const trimmedQuestion = question.trim();
    const trimmedAnswer = answer.trim();

    // Create a JSONL object and push it to the array
    const jsonlObject = {
        prompt: trimmedQuestion,
        completion: trimmedAnswer
    };
    jsonlArray.push(jsonlObject);
}

// Convert the array to JSONL format
const jsonlData = jsonlArray.map(obj => JSON.stringify(obj)).join('\n');

// Write the JSONL data to a new file
fs.writeFileSync('QnA.jsonl', jsonlData, 'utf8');

console.log('Conversion completed. JSONL file created.');
