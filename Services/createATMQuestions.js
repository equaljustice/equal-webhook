import mysql from 'mysql2/promise';

// Create a connection pool to the MySQL database


// Function to fetch data from MySQL and convert it to JSON
export async function getATMDataAsJson() {
    const pool = mysql.createPool({
        host: 'localhost',//'35.244.7.200',
        user: 'developer',
        password: 'H0Ku:;23ZG$Nb)r#',
        database: 'financial',
        connectionLimit: 10 // Adjust this based on your application's needs
    });
    const connection = await pool.getConnection();
    try {
        let jsonData = [];

        // Fetch questions data
        const [questionsRows, fields1] = await connection.execute('SELECT * FROM ATMquestions');
        for (const question of questionsRows) {

            // Fetch next question IDs
            const [nextIdsRows, fields2] = await connection.execute('SELECT nextQuestionId FROM ATMnext_question_ids WHERE qid = ?', [question.qid]);


            let choicesArray = [];
            // Fetch answer choices for choice type questions
            if (question.answerType === 'choice') {
                const [choicesRows, fields3] = await connection.execute('SELECT choice FROM ATManswer_choices WHERE qid = ?', [question.qid]);
                for (const choice of choicesRows) {
                    choicesArray.push(choice.choice);
                }
            }
            question.question ={
                text: question.question,
                audio_url: question.question_audio_url
            }
            question.question_help ={
                text: question.question_help,
                audio_url: question.question_help_audio_url
            }
            question.question_alt_1 ={
                text: question.question_alt_1,
                audio_url: question.question_alt_1_audio_url
            }
            // Construct the JSON object for this question
            let questionObj = {
                qid: question.qid,
                question: question.question,
                question_help: question.question_help,
                question_alt_1: question.question_alt_1,
                answerType: question.answerType,
                video_url: question.video_url,
                parameter: question.parameter,
                isLastQuestion: question.isLastQuestion === 1,
               
            };
            if (question.validation) {
                questionObj.validation = {}
                questionObj.validation.regex =  question.validation;
                questionObj.validation.errorMessage = question.errorMessage;
            }
            if (choicesArray && choicesArray.length) {
                questionObj.choices = choicesArray
            }
            if(nextIdsRows.length && nextIdsRows[0].nextQuestionId){
                questionObj.nextQuestionId = nextIdsRows[0].nextQuestionId;
            }
          
            jsonData.push(questionObj);
        }

        return jsonData;
    } catch (error) {
        console.log(error);
    } finally {
        connection.release(); // Release the connection back to the pool
    }
}

// Example usage:
 /*  getDataAsJson()
    .then(jsonData => {
        console.log(JSON.stringify(jsonData, null, 2)); // Print the JSON data
        return jsonData;
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });  
async function validateJson(){
    const connection = await pool.getConnection();
    const [validation, fields2] = await connection.execute('SELECT validation FROM questions WHERE validation is not null');

    validation.forEach(element => {
        try{
        console.log(element.validation);
        console.log(JSON.parse(element.validation));
        }catch(err){
            console.log(err);
        }
    });
    connection.release();
}
//validateJson(); */