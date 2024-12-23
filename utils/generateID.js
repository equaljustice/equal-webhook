export async function generateId(length) {
    const charset = '123456789';
    let ID = '';
  
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      ID += charset.charAt(randomIndex);
    }
  
    return ID;
  }