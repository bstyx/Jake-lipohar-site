const { finishLogin } = require("../lib/github-oauth");

module.exports = function callback(req, res) {
  return finishLogin(req, res);
};
