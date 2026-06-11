const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const db = require('../config/db'); // 🌟 MySQL DB 연결 객체 (상위 경로에 맞게 확인하세요)
const multer = require('multer');
const path = require('path');

// ==========================================
// 1. 사진 저장 설정 (multer)
// ==========================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // 사진이 저장될 폴더
    },
    filename: function (req, file, cb) {
        // 파일 이름이 겹치지 않게 날짜를 붙여서 저장
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// ==========================================
// 2. 임시 데이터 (테스트용 장소 데이터)
// ==========================================
const mockPlaces = [
    {
        id: "1",
        name: "카리나 추천 맛집 (성지순례)",
        address: "서울시 관악구 신림동",
        idolId: "karina", 
        category: "음식점",
        lat: 37.476,
        lng: 126.930,
        description: "성지순례 필수 코스! 맛있는 곳입니다."
    }
];

// ==========================================
// 3. API 라우터 설정
// ==========================================

// [회원가입 & 로그인]
router.post('/signup', userController.signup); 
router.post('/login', userController.login);

// [유저 정보 조회 (프로필)]
router.get('/profile/:email', userController.getUserProfile);

// [최애 아이돌 수정]
router.patch('/update-idol', userController.updateFavoriteIdol);

// [지도 성지순례 후기 등록 & 조회]
router.post('/posts', upload.single('photo'), userController.createPost); 
router.get('/posts', userController.getPosts);

// [게시글 수정 & 삭제]
router.patch('/posts/:id', userController.updatePost);
router.delete('/posts/:id', userController.deletePost);

// [★연동 해결용★ 장소 관련 API]
router.get('/places', (req, res) => {
    const idolId = req.query.idolId || req.query.idId; 
    const filteredPlaces = mockPlaces.filter(p => p.idolId === idolId);
    res.json(filteredPlaces);
});

// ==========================================
// 🎒 [추가] 방문 기록 (visit_history) 연동 API
// ==========================================

/**
 * [방문 기록 조회] 특정 유저(이메일)의 성지순례 방문 리스트 가져오기
 * GET /api/users/visit-history/:userEmail
 * (※ 프론트엔드 주소 구조에 맞춰 명시했습니다.)
 */
router.get('/visit-history/:userEmail', async (req, res) => {
    const { userEmail } = req.params;

    // visit_history와 spots 테이블을 JOIN하여 진짜 장소 이름(name)을 동적으로 긁어옵니다.
    const query = `
        SELECT 
            vh.id,
            vh.spot_id AS place_id,
            s.name AS place_name,
            DATE_FORMAT(COALESCE(vh.visit_date, vh.created_at), '%Y-%m-%d %H:%i') AS date
        FROM visit_history vh
        JOIN spots s ON vh.spot_id = s.id
        WHERE vh.user_email = ?
        ORDER BY COALESCE(vh.visit_date, vh.created_at) DESC
    `;

    try {
        const [rows] = await db.execute(query, [userEmail]);
        res.status(200).json(rows);
    } catch (err) {
        console.error('방문 기록 조회 중 DB 에러 발생:', err);
        res.status(500).json({ message: '방문 기록을 불러오는 중 서버 내부 에러가 발생했습니다.' });
    }
});

/**
 * [방문 인증 등록] 새로운 성지 발자국 남기기 (지도나 상세페이지에서 추후 사용)
 * POST /api/users/visit-history
 */
router.post('/visit-history', async (req, res) => {
    const { userEmail, spotId, visitDate } = req.body;

    if (!userEmail || !spotId) {
        return res.status(400).json({ message: '이메일과 장소 ID(spotId)는 필수 항목입니다.' });
    }

    const query = `
        INSERT INTO visit_history (user_email, spot_id, visit_date, created_at) 
        VALUES (?, ?, COALESCE(?, NOW()), NOW())
    `;

    try {
        await db.execute(query, [userEmail, spotId, visitDate || null]);
        res.status(201).json({ message: '성지순례 방문 인증 성공! 🎒' });
    } catch (err) {
        console.error('방문 기록 등록 중 DB 에러 발생:', err);
        res.status(500).json({ message: '방문 인증을 처리하는 중 오류가 발생했습니다.' });
    }
});

// ==========================================
// 4. 모듈 내보내기 (반드시 파일 맨 최하단에 위치!)
// ==========================================
module.exports = router;