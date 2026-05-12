const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// 에러 유발자였던 router.get('/test'...) 줄을 삭제했습니다!
router.post('/signup', userController.signup); 
router.post('/login', userController.login);

module.exports = router;

// 유저 정보 조회 (GET 방식)
router.get('/profile/:email', userController.getUserProfile);
// 최애 아이돌 수정 (PATCH 방식 - 일부 수정 시 주로 사용)
router.patch('/update-idol', userController.updateFavoriteIdol);