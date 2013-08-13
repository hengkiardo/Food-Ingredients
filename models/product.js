var mongoose = require('mongoose');
var Schema = mongoose.Schema; 


var ProductSchema = new Schema({
//define fields
  brandname            : {type: String,  uppercase: true},
  brandname_stripped   : {type: String,  uppercase: true}, //save brandname without punctuation for searches 
  productname          : {type: String,  uppercase: true},
  productname_stripped : {type: String,  uppercase: true}, //save productname without punctuation for searches
  ingredients          : {type: [String],lowercase: true},
  ingredients_stripped : {type: [String],lowercase: true}  //save ingredients without punctuation for searches
  
});

var Product = mongoose.model('Product', ProductSchema); // (model name , schema being used)

module.exports = Product; //then can require this in program and will have access to the Product model