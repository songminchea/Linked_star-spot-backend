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
// [지도 성지순례 후기 등록 & 방문 기록 자동 추가]
// [지도 성지순례 후기 등록 & 방문 기록 자동 추가]
router.post('/posts', upload.single('photo'), async (req, res) => {
    // 프론트엔드에서 넘겨주는 데이터들 수급
    const { userEmail, spotId, title, content } = req.body; 
    const photo = req.file ? `/uploads/${req.file.filename}` : null;

    if (!userEmail || !spotId) {
        return res.status(400).json({ message: '유저 이메일과 장소 ID(spotId)는 필수 항목입니다.' });
    }

    try {
        // 🌟 1. posts 테이블에 리뷰 게시글 데이터 추가
        const postQuery = `
            INSERT INTO posts (user_email, spot_id, title, content, photo_url, created_at) 
            VALUES (?, ?, ?, ?, ?, NOW())
        `;
        await db.execute(postQuery, [userEmail, spotId, title || '', content || '', photo]);

        // 🌟 2. visit_history 테이블에 방문 기록 데이터 동시에 추가 (화면 이동 없이 DB만 추가!)
        const visitQuery = `
            INSERT INTO visit_history (user_email, spot_id, visit_date, created_at) 
            VALUES (?, ?, NOW(), NOW())
        `;
        await db.execute(visitQuery, [userEmail, spotId]);

        // 🌟 3. 성공 피드백 반환 (페이지는 이동하지 않고 브라우저에 알림만 띄워줌)
        res.status(201).json({ 
            message: '후기 등록 및 방문 인증이 완료되었습니다! ✨' 
        });

    } catch (err) {
        console.error('후기 및 방문 기록 등록 중 DB 에러 발생:', err);
        res.status(500).json({ message: '등록 처리 중 서버 오류가 발생했습니다.' });
    }
});

// [★수정★ 지도 성지순례 후기 전체 또는 특정 유저별 조회]
router.get('/posts', async (req, res) => {
    const { userEmail } = req.query; // 💡 프론트엔드에서 보낸 이메일 파라미터 수급

    try {
        let query = `
            SELECT 
                p.id, p.user_email, p.spot_id, p.title, p.content, p.photo_url,
                DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS date,
                s.place_name, s.member_name
            FROM posts p
            LEFT JOIN spots s ON p.spot_id = s.id
        `;
        const params = [];

        // 🌟 userEmail이 인자로 들어오면, 해당 유저가 작성한 피드만 필터링!
        if (userEmail) {
            query += ` WHERE p.user_email = ?`;
            params.push(userEmail);
        }

        query += ` ORDER BY p.created_at DESC`;

        const [rows] = await db.execute(query, params);
        res.status(200).json(rows);

    } catch (err) {
        console.error('피드 목록 조회 중 DB 에러 발생:', err);
        res.status(500).json({ message: '피드를 불러오는 중 오류가 발생했습니다.' });
    }
});

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

    // 🌟 spots 테이블의 진짜 컬럼명인 s.place_name을 사용합니다!
    // 보너스로 s.member_name(최애 멤버) 정보도 함께 가져와서 화면을 더 풍성하게 만듭니다.
    const query = `
        SELECT 
            vh.id,
            vh.spot_id AS place_id,
            IFNULL(s.place_name, '확인되지 않은 성지 장소') AS place_name,
            IFNULL(s.member_name, '') AS member_name,
            DATE_FORMAT(COALESCE(vh.visit_date, vh.created_at), '%Y-%m-%d %H:%i') AS date
        FROM visit_history vh
        LEFT JOIN spots s ON vh.spot_id = s.id
        WHERE vh.user_email = ?
        ORDER BY COALESCE(vh.visit_date, vh.created_at) DESC
    `;

    try {
        const [rows] = await db.execute(query, [userEmail]);
        res.status(200).json(rows);
    } catch (err) {
        console.error('방문 기록 조회 중 DB 에러 발생:', err);
        res.status(500).json({ message: '방문 기록을 불러오는 중 오류가 발생했습니다.' });
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