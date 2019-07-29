# replace field:
# mongo gomngr --quiet --eval 'db.getCollection("users").updateMany( {}, { $rename: { "is_genouest": "is_internal" } } )'


# add a new field with same value
mongo gomngr --quiet --eval 'db.users.find().snapshot().forEach(
  function (elm) {
    db.users.update (
             { _id: elm._id },
             { $set: {is_internal: elm.is_genouest}}
    );
  }
)';

# check
#mongo gomngr --quiet --eval 'db.users.find().toArray()'
