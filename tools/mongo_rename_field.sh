# replace field:
# mongo gomngr --quiet --eval 'db.getCollection("users").updateMany( {}, { $rename: { "is_genouest": "is_internal" } } )'


# add a new field with same value
# is_genouest => is_internal
#mongo gomngr --quiet --eval 'db.users.find().snapshot().forEach(
#  function (elm) {
#    db.users.update (
#             { _id: elm._id },
#             { $set: {is_internal: elm.is_genouest}}
#    );
#  }
#)';

# group => team
mongo gomngr --quiet --eval 'db.users.find().snapshot().forEach(
  function (elm) {
    db.users.update (
             { _id: elm._id },
             { $set: {team: elm.group}}
    );
  }
)';

# check
#mongo gomngr --quiet --eval 'db.users.find().toArray()'
