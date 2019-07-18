mongo gomngr --quiet --eval 'db.getCollection("users").updateMany( {}, { $rename: { "is_genouest": "is_internal" } } )'
