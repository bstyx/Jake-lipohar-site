const { startLogin } = require("../lib/github-oauth");

module.exports = function auth(req, res) {
  return startLogin(req, res);
};
