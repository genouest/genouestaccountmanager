mongo gomngr --quiet --eval 'db.users.find({expiration: {$lt: (new Date().getTime() + 60 * (1000 * 60 * 60 * 24))}}).forEach(
  function (elm) {
    let new_expire = new Date().getTime() + 63 * (1000 * 60 * 60 * 24);
    db.users.update (
             { _id: elm._id },
             { $set: {expiration: new_expire }}
    );
  }
)';

mongo gomngr --quiet --eval 'db.users.find({"expiration" : {"$exists": false}}).forEach(
  function (elm) {
    let new_expire = new Date().getTime() + 63 * (1000 * 60 * 60 * 24);
    db.users.update (
             { _id: elm._id },
             { $set: {expiration: new_expire }}
    );
  }
)';


# mongo gomngr --quiet --eval 'db.users.find({expiration: {$lt: (new Date().getTime())}})'

# mongo gomngr --quiet --eval 'db.users.find({"expiration" : {"$exists": false}})'

# mongo gomngr --quiet --eval 'db.users.find({expiration: {$lt: (new Date().getTime() + 60 * (1000 * 60 * 60 * 24))}})'
