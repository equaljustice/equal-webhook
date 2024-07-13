/* import mailchimpClient from "@mailchimp/mailchimp_transactional"
const mailClient = new mailchimpClient(
    "md-it8Upep8tA7b-Lp1Z_QA_g"
  );
  
  const run = async () => {
    const response = await mailClient.messages.sendTemplate({
      template_name: "Test template for routine",
      template_content: [{}],
      message: {},
    });
    console.log(response);
  };
  
  run(); */

  import mailchimpClient from "@mailchimp/mailchimp_transactional"
const mailClient = new mailchimpClient(
    "cc08af718e48558fab15a88033092753-us4"
  );   


// Function to send an HTML email
async function sendEmail() {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Personalized Routine</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
            }
            .container {
                padding: 20px;
                max-width: 600px;
                margin: 0 auto;
                background-color: #f9f9f9;
                border: 1px solid #ddd;
            }
            h1 {
                color: #333;
            }
            h2 {
                color: #555;
            }
            a {
                color: #007BFF;
                text-decoration: none;
            }
            a:hover {
                text-decoration: underline;
            }
            .category {
                margin-bottom: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <p>Hola Iris,</p>
            <p>Aquí tienes una rutina personalizada para tratar la flacidez, las líneas de expresión y el tono apagado de tu piel:</p>
            
            <div class="category">
                <h2>Limpieza</h2>
                <ol>
                    <li><a href="https://www.adonianatur.com/limpiadora-cremosa-calmante-con-magnesio-de-novexpert-200ml.html">LIMPIADORA CREMOSA CALMANTE CON MAGNESIO DE NOVEXPERT 150ml. | Adonia Natur</a> - Limpia suavemente sin resecar, ideal para pieles secas y maduras.</li>
                    <li><a href="https://www.adonianatur.com/limpiador-iluminador-en-gel-juliet-de-antipodes.html">Limpiador Iluminador en Gel Juliet de Antipodes | Adonia Natur</a> - Elimina suavemente el maquillaje y las impurezas mientras nutre la piel con antioxidantes.</li>
                </ol>
            </div>
    
            <div class="category">
                <h2>Tónico</h2>
                <ol>
                    <li><a href="https://www.adonianatur.com/tonico-suave-y-antioxidante-ananda-100ml-de-antipodes.html">Tónico Suave y Antioxidante Ananda 100ml. de Antípodes | Adonia Natur</a> - Hidrata y refresca la piel, preparándola para los siguientes pasos.</li>
                    <li><a href="https://www.adonianatur.com/solucion-bifasica-con-acido-hialuronico-de-annemarie-borlind-50ml.html">Solución bifásica con ácido hialurónico de Annemarie Börlind 50ml | Adonia Natur</a> - Tonifica y calma la piel, dejándola suave y revitalizada.</li>
                </ol>
            </div>
    
            <div class="category">
                <h2>Suero</h2>
                <ol>
                    <li><a href="https://www.adonianatur.com/booster-concentrado-pro-colageno-de-novexpert-30ml.html">Booster Concentrado Pro-Colágeno de Novexpert 30ml. | Adonia Natur</a> - Estimula la producción de colágeno y elastina, mejorando la firmeza y elasticidad de la piel.</li>
                    <li><a href="https://www.adonianatur.com/mini-antipodes-glow-ritual-vitamin-c-serum.html">MINI Antipodes Glow Ritual Vitamin C Serum 10ml. | Adonia Natur</a> - Ilumina el tono de la piel y reduce la apariencia de las manchas oscuras.</li>
                </ol>
            </div>
    
            <div class="category">
                <h2>Crema de día</h2>
                <ol>
                    <li><a href="https://www.adonianatur.com/la-crema-antiedad-age-expert-de-novexpert-40ml.html">La Crema Antiedad Pro Colágeno de Novexpert 40ml | Adonia Natur</a> - Hidrata profundamente y protege la piel de los agresores ambientales, reduciendo los signos del envejecimiento.</li>
                    <li><a href="https://www.adonianatur.com/crema-de-dia-system-absolute-annemarie-borlind.html">Crema de Día Rich System Absolute de Annemarie Borlind 50ml</a> - Reafirma la piel y reduce la apariencia de las arrugas.</li>
                </ol>
            </div>
    
            <div class="category">
                <h2>Crema de noche</h2>
                <ol>
                    <li><a href="https://www.adonianatur.com/la-crema-antiedad-age-expert-de-novexpert-40ml.html">La Crema Antiedad Pro Colágeno de Novexpert 40ml | Adonia Natur</a> - Regenera la piel durante la noche, mejorando su firmeza y elasticidad.</li>
                    <li><a href="https://www.adonianatur.com/crema-de-noche-ll-annemarie-borlind.html">Crema Noche LL Regeneration de Annemarie Borlind 50ml</a> - Reduce las arrugas y líneas de expresión mientras hidrata la piel.</li>
                </ol>
            </div>
    
            <div class="category">
                <h2>Contorno de ojos</h2>
                <ol>
                    <li><a href="https://www.adonianatur.com/contorno-de-ojos-flash-vitamina-c-de-novexpert.html">CONTORNO DE OJOS FLASH VITAMINA C DE NOVEXPERT 15ml. | Adonia Natur</a> - Reduce las arrugas y líneas de expresión alrededor de los ojos.</li>
                    <li><a href="https://www.adonianatur.com/pura-soft-q10-contorno-de-ojos-crema-fluida-reafirmante.html">Contorno de Ojos Purasoft Q10 de Annemarie Borlind 15ml</a> - Reafirma la piel alrededor de los ojos y reduce las bolsas y ojeras.</li>
                </ol>
            </div>
    
            <p>Espero que esta rutina te ayude a mejorar el aspecto de tu piel. Si tienes alguna pregunta, no dudes en ponerte en contacto conmigo.</p>
        </div>
    </body>
    </html>
  `;

  try {
    const response = await mailClient.messages.send({
      message: {
        from_email: "adonia@adonianatur.com",
        subject: "Tu rutina personalizada de cuidado de la piel",
        html: htmlContent,
        to: [
          {
            email: "chetan.aps@alchemis.ai",
            type: "to",
          },
        ],
      },
    });
    console.log('Email sent successfully:', response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

sendEmail();

  