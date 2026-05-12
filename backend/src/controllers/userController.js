const db = require('../config/db');
const bcrypt = require('bcrypt');

// 회원가입 로직
exports.signup = async (req, res) => {
    const { email, password, nickname, favorite_idol } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (email, password, nickname, favorite_idol) VALUES (?, ?, ?, ?)';
        await db.execute(sql, [email, hashedPassword, nickname, favorite_idol || null]);
        res.status(201).json({ success: true, message: "회원가입 성공!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "회원가입 실패: " + err.message });
    }
};

// 로그인 로직
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(400).json({ message: "유저를 찾을 수 없습니다." });

        const isMatch = await bcrypt.compare(password, rows[0].password);
        if (!isMatch) return res.status(400).json({ message: "비밀번호가 틀렸습니다." });

        res.json({ success: true, message: "로그인 성공!", user: { nickname: rows[0].nickname } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 유저 정보 조회
exports.getUserProfile = async (req, res) => {
    const { email } = req.params; // 주소창에서 이메일을 받아옴
    try {
        const [rows] = await db.query('SELECT email, nickname, favorite_idol FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(404).json({ message: "유저를 찾을 수 없습니다." });
        res.status(200).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 최애 아이돌 수정
exports.updateFavoriteIdol = async (req, res) => {
    const { email, new_idol } = req.body;
    try {
        await db.query('UPDATE users SET favorite_idol = ? WHERE email = ?', [new_idol, email]);
        res.status(200).json({ success: true, message: "최애 아이돌이 변경되었습니다!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};