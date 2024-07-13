import { v1beta } from '@google-cloud/discoveryengine';
import serializer from 'proto3-json-serializer';
const { SearchServiceClient } = v1beta;

let textContent = `Hola Iris, aquí tienes una rutina personalizada para tratar la flacidez, las líneas de expresión y el tono apagado de tu piel:

*Limpieza*
1. ##Leche Limpiadora de Magnesio de Novexpert## - Limpia suavemente sin resecar, ideal para pieles secas y maduras.
2. ##Aceite Limpiador Antioxidante de Antipodes## - Elimina suavemente el maquillaje y las impurezas mientras nutre la piel con antioxidantes.

*Tónico*
1. ##Tónico Hidratante Ananda de Antipodes## - Hidrata y refresca la piel, preparándola para los siguientes pasos.
2. ##Agua Termal de Annemarie Börlind## - Tonifica y calma la piel, dejándola suave y revitalizada.

*Suero*
1. ##Sérum Pro-Colágeno de Novexpert## - Estimula la producción de colágeno y elastina, mejorando la firmeza y elasticidad de la piel.
2. ##Sérum Iluminador de Antipodes## - Ilumina el tono de la piel y reduce la apariencia de las manchas oscuras.

*Crema de día*
1. ##Crema de Día Antienvejecimiento de Novexpert## - Hidrata profundamente y protege la piel de los agresores ambientales, reduciendo los signos del envejecimiento.
2. ##Crema de Día Reafirmante de Annemarie Börlind## - Reafirma la piel y reduce la apariencia de las arrugas.

*Crema de noche*
1. ##Crema de Noche Reafirmante de Novexpert## - Regenera la piel durante la noche, mejorando su firmeza y elasticidad.
2. ##Crema de Noche Antiarrugas de Annemarie Börlind## - Reduce las arrugas y líneas de expresión mientras hidrata la piel.

*Contorno de ojos*
1. ##Contorno de Ojos Antienvejecimiento de Novexpert## - Reduce las arrugas y líneas de expresión alrededor de los ojos.
2. ##Contorno de Ojos Reafirmante de Annemarie Börlind## - Reafirma la piel alrededor de los ojos y reduce las bolsas y ojeras.

Espero que esta rutina te ayude a mejorar el aspecto de tu piel. Si tienes alguna pregunta, no dudes en ponerte en contacto conmigo.`;

// Extract product names
const productNames = [];
const regex = /##(.*?)##/g;
let match;
while ((match = regex.exec(textContent)) !== null) {
  productNames.push(match[1]);
}

// Create JSON array list of product names
const productList = productNames.map(product => ({ name: product }));
console.log('Extracted Products:', productList);

// Define function to search products using Vertex AI Search SDK and update the text content
const projectId = 'ai-agent-sandbox';
const location = 'global';              // Options: 'global', 'us', 'eu'
const collectionId = 'default_collection';     // Options: 'default_collection'
const dataStoreId = 'www-adonia_1719998187387';      // Create in Cloud Console
const servingConfigId = 'default_config';      // Options: 'default_config'

const apiEndpoint =
  location === 'global'
    ? 'discoveryengine.googleapis.com'
    : `${location}-discoveryengine.googleapis.com`;

const client = new SearchServiceClient({ apiEndpoint: apiEndpoint });

async function searchProduct(productName) {
  // The full resource name of the search engine serving configuration.
  const name = client.projectLocationCollectionDataStoreServingConfigPath(
    projectId,
    location,
    collectionId,
    dataStoreId,
    servingConfigId
  );

  const request = {
    pageSize: 1,
    query: productName,
    servingConfig: name,
  };

  try {
    const [response] = await client.search(request, { autoPaginate: false });
    console.log(JSON.stringify(response,null,2));
    

    if (response) {
        let result = response[0];
        if (result && result.document && result.document.derivedStructData) {
          const fields = result.document.derivedStructData.fields;
          const title = fields.title.stringValue;
          const link = fields.link.stringValue;
          const hyperlink = `<a href="${link}">${title}</a>`;
          const originalText = `##${productName}##`;
          textContent = textContent.replace(new RegExp(`##${productName}##`, 'g'), hyperlink);
        }
    } else {
      console.error(`No search results for "${productName}"`);
    }
  } catch (error) {
    console.error(`Error searching for "${productName}":`, error);
  }
}

// Search each product and update text content
(async () => {
  for (const product of productNames) {
    await searchProduct(product);
  }
  console.log('Updated Text Content:', textContent);
})();
