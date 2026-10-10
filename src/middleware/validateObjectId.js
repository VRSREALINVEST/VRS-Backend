// A malformed :id is a client error. Answer 400 here, before any upload is
// buffered or any query runs, instead of letting a CastError surface as a 500.
module.exports = (req, res, next) => {
  if (!/^[0-9a-f]{24}$/i.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid id" });
  }
  next();
};
