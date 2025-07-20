const DatabaseService = require('../services/database');
const { createErrorResponse } = require('../utils/response');

const dbService = new DatabaseService();

/**
 * 인스턴스 존재 확인 미들웨어
 */
const checkInstanceExists = async (req, res, next) => {
  try {
    const { name } = req.params;
    const instance = await dbService.getInstance(name);
    
    if (!instance) {
      return res.status(404).json(createErrorResponse('Instance not found'));
    }
    
    req.instance = instance;
    next();
  } catch (error) {
    res.status(500).json(createErrorResponse(error.message));
  }
};

module.exports = {
  checkInstanceExists
}; 