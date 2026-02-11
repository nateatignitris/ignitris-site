export default async function handler(req, res) {
    const { code } = req.query;
    if (!code) return res.redirect(302, '/');
    return res.redirect(302, `/?ref=${encodeURIComponent(code)}`);
}
