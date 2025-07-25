//const { reactToComment } = require("./comment/reactToComment");

module.exports = {
  createPost: require("./post/createPost"),
  getPosts: require("./post/getPosts"),
  commentPost: require("./comment/commentPost"),
  replyToComment: require("./comment/replyToComment"),
  deleteComment: require("./comment/deleteComment"),
  editComment: require("./comment/editComment"),
  reactToPost: require("./post/reactToPost"),
  editPost: require("./post/editPost"),
  deletePost: require("./post/deletePost"),
  reactToComment: require("./comment/reactToComment"),
};
