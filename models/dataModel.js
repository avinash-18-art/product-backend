let latestData = null;

module.exports = {
  getLatestData: () => latestData,
  setLatestData: (data) => { latestData = data; }
};
