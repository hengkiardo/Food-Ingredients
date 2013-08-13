var ProductController = function () {
    "use strict";
    var self = this;
    var Product = require('../models/product'),
        nodemailer = require('nodemailer'),
        productArray = require('../fixtures'),
        config = require('../config/config');


    Product.find(function (err, products) {
        if (err) {
            return err;
        }else {
            if (Object.keys(products).length < 1) {
                for (var item in productArray) {
                    self.saveProduct(productArray[item]);
                }
            }
        }
    });

    function send(res, msg) {
        if (res !== undefined) {
            res.send(msg);
        } else {
            console.log(msg);
        }
    }

    this.strip = function (item) {
        //strip all punctuation, leave whitespaces between words, strip whitespace at the beginning, strip whitespace at the end
        return item.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").replace(/^\s+/, '').replace(/\s+$/, '');
    };

    this.showAllProducts = function (req, res, callback) {
        Product.find(function (err, products) {
            if (err) {
                return callback(err);
            } else if (res !== undefined) {
                res.send(products);
            } else {
                return callback(null, products); //res.send(products);
            }
        });
    };

    this.removeAllProducts = function (req, res) {
        Product.find().remove();
    };

    this.findProduct = function (req, res, callback) {
        var obj = req.body || req,
            brandname,
            re_brandname,
            productname,
            re_productname,
            ingredient,
            re_ingredient,
            notIngredient = false,
            searchObj = {},
            empty,
            serverReq = false,
            webReq = false,
            item;

        //method to create array of ingredients, each as regular expression
        function getIng(ing) {
            if ((ing !== '') && (ing !== undefined)) {
                var ingArr = ing.split(' '),
                    ingStr = '';

                for (item = 0; item < ingArr.length; item++) {
                    ingArr[item] = new RegExp(ingArr[item], 'i');
                }

                return ingArr;
            }
        }

        //method to perform the search on the database using the search object created
        function search(str) {
            Product.find(str, function (err, products) {
                if (err) {
                    return callback(err);
                } else if (res !== undefined) {
                    res.render('search_results', { title: 'Results', nbsp: ' ', results: products });
                } else {
                    callback(null, products);
                }
            });
        }

        //determine wheather web request or server request, define empty value    
        if (obj === req.body) {
            webReq = true;
            empty = '';
        } else {
            serverReq = true;
            empty = undefined;
        }

        //reformat user-set brandname, productname, and ingredient using regex for searching the database
        if (obj.brandname !== empty) {
            brandname = obj.brandname.toUpperCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").replace(/^\s+/, '').replace(/\s+$/, '');
        }

        if (obj.productname !== empty) {
            productname = obj.productname.toUpperCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").replace(/^\s+/, '').replace(/\s+$/, '');
        }

        if (obj.ingredient !== empty) {
            ingredient = obj.ingredient.toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").replace(/^\s+/, '').replace(/\s+$/, '');
        }

        if ((obj.notIngredient !== empty) && (obj.ingredient !== empty)) {
            notIngredient = obj.notIngredient;
        }

        //create regex for partial match
        re_brandname = new RegExp('^' + brandname);
        re_productname = new RegExp("(\\s|^)" + productname + "(\\s|$)", "i");
        re_ingredient = getIng(ingredient);

        //create search object
        if (obj.brandname !== empty) {
            searchObj.brandname_stripped = re_brandname;
        }
        if (obj.productname !== empty) {
            searchObj.productname_stripped = re_productname;
        }
        if (obj.ingredient !== empty) {
            if (obj.notIngredient !== undefined) {
                searchObj.ingredients_stripped = {$nin: re_ingredient.valueOf()};
            } else {
                searchObj.ingredients_stripped = {$all: re_ingredient.valueOf()};
            }
        }

        //retrieve the search results from the database
        search(searchObj);
    };

    this.contribute = function (req, res) {

        var brandname = req.body.brandname.toUpperCase(),
            productname = req.body.productname.toUpperCase(),
            ingredients = req.body.ingredients.toLowerCase(),
            re_brandname = new RegExp('^' + brandname),
            re_productname = new RegExp("(\\s|^)" + productname + "(\\s|$)", "i"),
            smtpTransport = nodemailer.createTransport("SMTP", {
                service: "Gmail",
                auth: {
                    user: process.env.user || config.user,
                    pass: process.env.pass || config.pass
                }
            });

        Product.find({'brandname_stripped' : re_brandname, 'productname_stripped' : re_productname}, function (err, products) {
            if (products.length === 0) {
                smtpTransport.sendMail({
                    from: "Know Your Food Contribution <KnowYourFoodIngredients@gmail.com>", // sender address
                    to: "Know Your Food <KnowYourFoodIngredients@gmail.com>", // comma separated list of receivers
                    subject: "Know Your Food Contribution", // Subject line
                    text: 'BRAND NAME: ' + brandname + '\nPRODUCT NAME: ' + productname + '\nINGREDIENTS: ' + ingredients
                }, function(error, response) {
                    if (error) {
                        send(res, error.message);
                    } else {
                        res.render('contribute', { title: 'Contribute', nbsp: ' ', message: 'Your contribution has been sent.  Thank you!' });
                    }
                });
            } else {
                res.render('contribute', { title: 'Contribute', nbsp: ' ', message: 'The product you entered already exists in the database' });
            }
        });
    };

    this.saveProduct = function (req, res) {
        var obj = req.body || req,
            ingredients_array,
            brandname,
            brandname_stripped,
            productname,
            productname_stripped,
            ingredients,
            ingredients_stripped,
            ingredients_stripped_array;

        //check if req is from file or web    
        if (obj.brandname && obj.productname && obj.ingredients) {
            brandname = obj.brandname.toUpperCase();
            productname = obj.productname.toUpperCase();
            ingredients = obj.ingredients.toLowerCase();
        }

        brandname_stripped = this.strip(brandname);
        productname_stripped = this.strip(productname);
        ingredients_stripped = ingredients.replace(/['";:.\/?\\\-]/g, '');

        //parse ingredients by commas and store in array
        ingredients_array = ingredients.split(',');
        ingredients_stripped_array = ingredients_stripped.split(',');

        //require all fields
        if ((brandname !== "") && (productname !== "") && (ingredients !== "")) {
            //Test if product already exists
            Product.count({ brandname_stripped : brandname_stripped, productname_stripped : productname_stripped }, function (err, count) {
                if (err) {
                    send(res, err);
                } else if (count >= 1) {
                    send(res, "The following product already exists in the database and was not saved: \n  ~  " + brandname + " " + productname);
                } else {
                    //create the new product
                    var newProduct = new Product({
                        'brandname' : brandname,
                        'brandname_stripped' : brandname_stripped,
                        'productname' : productname,
                        'productname_stripped' : productname_stripped,
                        'ingredients' : ingredients_array,
                        'ingredients_stripped' : ingredients_stripped_array
                    });

                    //save the new product to the database
                    newProduct.save(function (err, newProduct) {
                        if (err) {
                            send(res, err);
                        } else {
                            //send confirmation that product was saved
                            send(res, "The following was written to the database: \n" + newProduct);
                        }
                    });
                }
            });
        } else {
            send("All fields are required");
        }
    };

    this.contact = function (req, res) {
        console.log(config);
        var contactName = req.body.name,
            returnEmail = req.body.email,
            message = req.body.message,
            smtpTransport = nodemailer.createTransport("SMTP", {
                service: "Gmail",
                auth: {
                    user: process.env.user || config.user,
                    pass: process.env.pass || config.pass
                }
            });

        smtpTransport.sendMail({
            from: "Know Your Food Contribution <KnowYourFoodIngredients@gmail.com>", // sender address
            to: "Know Your Food <KnowYourFoodIngredients@gmail.com>", // comma separated list of receivers
            subject: "Contact Us", // Subject line
            text: 'NAME: ' + contactName + '\nEMAIL ADDRESS: ' + returnEmail + '\nMESSAGE: ' + message
        }, function(error, response) {
            if (error) {
                send(res, error.message);
            } else {
                res.render('message', { title: 'Message', nbsp: ' ', message: 'The following message has been sent to Know Your Food.  Thank you!', from: contactName, email: returnEmail, messageBody: message });
            }
        });
    };

};

module.exports = ProductController;