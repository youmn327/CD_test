const Storage = {
  KEY: 'cd_submissions',

  getAll() {
    return JSON.parse(localStorage.getItem(this.KEY) || '[]');
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  add(submission) {
    const all = this.getAll();
    all.push({
      ...submission,
      timestamp: String(Date.now()) + String(Math.random()).slice(2, 6),
    });
    this.save(all);
    return all;
  },

  remove(timestamp) {
    const all = this.getAll().filter(s => s.timestamp !== timestamp);
    this.save(all);
    return all;
  },

  getByMember(memberId) {
    return this.getAll().filter(s => s.member === memberId);
  },

  isSubmitted(memberId, problemId) {
    return this.getAll().some(s => s.member === memberId && s.problemId === problemId);
  },

  getMonthlySummary() {
    const all = this.getAll();
    const summary = {};

    CONFIG.MEMBERS.forEach(m => { summary[m.id] = {}; });

    all.forEach(s => {
      const month = s.date.slice(0, 7); // "YYYY-MM"
      if (!summary[s.member]) summary[s.member] = {};
      summary[s.member][month] = (summary[s.member][month] || 0) + 1;
    });

    return summary;
  },

  exportJSON() {
    return JSON.stringify(this.getAll(), null, 2);
  },

  importJSON(jsonString) {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data)) throw new Error('Invalid format');
    this.save(data);
    return data;
  },
};
