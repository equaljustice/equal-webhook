import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const authenticate = (req, res) => {
    const { password } = req.body;
    const hashedPassword = '$2a$10$aiHvSid0zSdTevHWujQGEOlc3hCG3oBcOUNfTNZJ2U2QIHzh66xey'
  
    bcrypt.compare(password, hashedPassword, (err, result) => {
      if (err || !result) {
        res.status(401).send('Unauthorized');
      } else {
        const token = jwt.sign({ userId: hashedPassword }, process.env.countrystatecity, { expiresIn: '1h' });
  res.json({ token });
      }
    });
  };

  export const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
  
    if (!token) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }
  
    jwt.verify(token, process.env.countrystatecity, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }
      console.log('authenticated', decoded);
      next();
    });
  };