import {Storage} from '@google-cloud/storage';
import * as constants from '../constants.js';
export const listFiles = async (req, res) =>{
    try{
      const storage = new Storage();
        const folderName = req.params.folder;
        if(!folderName){
          res.status(400).send('Please provide folder Name');
        }
        const bucketName = constants.PUBLIC_BUCKET_DEV;
        const [files] = await storage.bucket(bucketName).getFiles({ prefix: folderName });
        const fileList = files.map(file => file.name);
        res.json(fileList);
      } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).send('Internal Server Error');
      }
}

export const downloadFile = async (req, res) => {
  try {
    const storage = new Storage();
    const fileName = req.params.filename;
    const folder =req.params.folder;
    const bucketName = constants.PUBLIC_BUCKET_DEV;
    const file = storage.bucket(bucketName).file(folder+'/'+fileName);
    const stream = file.createReadStream();
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    stream.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).send('Internal Server Error');
  }
}