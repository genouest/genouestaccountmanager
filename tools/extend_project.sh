#  expire: {$lt: (new Date().getTime())}

# mongo gomngr --quiet --eval 'db.getCollection("projects").find({expire: {$lt: (new Date().getTime())}})'


mongo gomngr --quiet --eval 'db.projects.find({expire: {$lt: (new Date().getTime())}}).forEach(
  function (elm) {
    let new_expire = new Date().getTime() + 42 * (1000 * 60 * 60 * 24);
    if (elm.gid) {
       new_expire = new Date().getTime() + (42 + elm.gid % 100) * (1000 * 60 * 60 * 24);
    }
    db.projects.update (
             { _id: elm._id },
             { $set: {expire: new_expire }}
    );
  }
)';

mongo gomngr --quiet --eval 'db.projects.find({"expire" : {"$exists": false}}).forEach(
  function (elm) {
    let new_expire = new Date().getTime() + 42 * (1000 * 60 * 60 * 24);
    if (elm.gid) {
       new_expire = new Date().getTime() + (42 + elm.gid % 100) * (1000 * 60 * 60 * 24);
    }
    db.projects.update (
             { _id: elm._id },
             { $set: {expire: new_expire }}
    );
  }
)';


# mongo gomngr --quiet --eval 'db.getCollection("projects").deleteMany({})'


# mongo gomngr --quiet --eval 'db.projects.find({"expire" : {"$exists": false}})'


# abims
mongo gomngr --quiet --eval 'db.projects.find({}).forEach(
  function (elm) {
    let new_expire = elm.created_at + 365 * (1000 * 60 * 60 * 24);
    db.projects.update (
             { _id: elm._id },
             { $set: {expire: new_expire }}
    );
  }
)';
