odoo.define('common_models.model_widget', function (require) {

    var core = require('web.core');
    var Widget= require('web.Widget');
    var widgetRegistry = require('web.widget_registry');
    var FieldManagerMixin = require('web.FieldManagerMixin');

    var data = require('web.data');
    var time = require('web.time');
    var utils = require('web.utils');

    var QWeb = core.qweb;
    var _t = core._t;

    var model_widget = Widget.extend(FieldManagerMixin, {
            custom_events: _.extend({}, FieldManagerMixin.custom_events, {
                field_changed: function(event) {
                    this.field_changed(event);
                },
            }),
            events: {
                "click #sync_models": "update_order_lines",
                "click .row_delete>button": "delete_row",
                "click #copy_to_all": "copy_to_all"
            },
            init: function (parent, model, state) {
                this._super(parent);
                FieldManagerMixin.init.call(this);
                var self = this;
                self.updating = false;
                self.initialized = false;
                self.reload_after_save = false;
                self.defs = [];
                self.set('measurebars', []);
                var lines = {order_lines: []};
                localStorage.setItem("order_lines", JSON.stringify(lines));
                self.common_quantity_name = ''; // generalisation of the quantity name
                switch (model.model) {
                    case 'sale.order':
                        self.common_quantity_name = 'product_uom_qty';
                        self.common_lines_name = 'order_line';
                        break;
                    case 'purchase.order':
                        self.common_quantity_name = 'product_qty';
                        self.common_lines_name = 'order_line';
                        break;
                    case 'account.invoice':
                        self.common_quantity_name = 'product_qty';
                        self.common_lines_name = 'invoice_line_ids';
                        break;
                    default:
                        alert("The widget wil not work properly on this view, only works on sale.order or purchase.order");
                }

                // Original save function is overwritten in order to wait all running deferreds to be done before actually applying the save.

                this.model.original_save = _.bind(this.model.save, model);
                this.model.save = function (prepend_on_create) {
                    console.log('save')
                    self.prepend_on_create = prepend_on_create;

                    if (!self.get("effective_readonly")) {
                        self.update_order_lines(false)
                    }
                    //self.update_order_lines(false);
                    return $.when.apply($, self.defs).then(function () {
                        self.reload_after_save = true;
                        return self.model.original_save(self.prepend_on_create);
                    });
                };

                self.initialize_content();

            },

            field_changed: function(ev) {
                if (self.updating || !self.initialized) {
                    return;
                }
                if (env == 'name') {
                    self.initialize_content();
                }else if(env in ('order_line','invoice_line_ids')){
                    self.update_models();
                }
            },

            copy_to_all: function (event) {
                var self = this;
                if (event) {
                    event.preventDefault();
                }

                $('.oe-copy-input-field').each(function (index, element) {
                    var id = self.get_id_from_class(element, 'attribute-')
                    var value = parseFloat($(element).val());

                    if (isNaN(value)) {
                        // empty or wrong fields are dismissed
                        return;
                    }

                    $('.oe-product-input-field.attribute-' + id).each(function (index, element) {
                        $(element).val(value);
                    });

                    $(element).val('');

                })
            },
            initialize_content: function () {
                console.log('hola');
                var self = this;
                self.destroy_content();
                this._rpc({
                    model: model.model,
                    method: 'get_model_lines',
                    args: [JSON.parse(this.value).invoice_id, id],
                }).then(function () {
                    self.trigger_up('reload');
                });

                //self.convert_to_models();
            },
            execute_on_products: function (bar_id, model_id, product_id, product_func) {
                var self = this;

                var has_changes = false;
                var measurebars = self.get('measurebars');
                _.each(measurebars, function (bar) {

                    if (bar_id && bar.id != bar_id) {
                        return;
                    }

                    _.each(bar.models, function (model) {

                        if (model_id && model.product_template_id != model_id) {
                            return;
                        }

                        var total_qty = 0;
                        _.each(model.products, function (product) {
                            if (!product.id) {
                                // skip empty cells (no variant for the product)
                                return;
                            }

                            if (product_id && product.id != product_id) {
                                total_qty += product.quantity;
                                return;
                            }

                            total_qty += product_func(bar, model, product);
                        });

                        if (total_qty == 0 && model.total_quantity) {
                            return;
                        }

                        has_changes = true;
                        model.total_quantity = total_qty;
                        model.total_price = 0.0;
                        var model_element = self.$(".model-" + model.product_template_id);
                        $(model_element).find('.oe_total_quantity').html(model.total_quantity);
                        $(model_element).find('.oe_total_price').html("0.00");
                    });
                });
                if (has_changes) {
                    self.set('measurebars', measurebars);
                }
            },
            display_data: function () {
                var self = this;
                self.initialized = true;
                self.$el.html(QWeb.render("AttributeModels", {widget: self}));

                if (self.view.dataset.model != 'account.invoice') {
                    // don't add models in invoices, just use them
                    self.init_add_model();
                }
                self.set_read_write();
            },
            convert_to_models: function () {
                var self = this;
                new Model(self.view.model).call("get_model_lines",
                    {
                        'context': new data.CompoundContext(
                            {
                                'user_id': self.get('user_id'),
                                'id': self.view.datarecord.id
                            })
                    })
                    .then(function (result) {
                        self.querying = true;

                        self.set('measurebars', result);

                        self.querying = false;
                    })
                    .then(function () {
                        self.display_data();
                    });

            },
            init_add_model: function () {
                var self = this;

                if (self.get("effective_readonly")) {
                    return;
                }

                if (self.dfm) {
                    self.destroy_content();
                }

                self.$(".oe_models_add_row").show();
                self.dfm = new form_common.DefaultFieldManager(self);
                self.dfm.extend_field_desc({
                    models: {
                        relation: "product.template.model"
                    }
                });

                var currentids = [];
                var measurebars = self.get('measurebars');
                for (var i = 0; i < measurebars.length; i++) {
                    var bar = measurebars[i];
                    for (var j = 0; j < bar.models.length; j++) {
                        var model = bar.models[j];
                        currentids.push(model.product_template_id);
                    }
                }
                var FieldMany2One = core.form_widget_registry.get('many2one');
                self.model_m2o = new FieldMany2One(self.dfm, {
                    attrs: {
                        name: "models",
                        type: "many2one",
                        domain: [
                            ['id', 'not in', currentids],
                        ],
                        context: {},
                        modifiers: '{"required": true}'
                    }
                });

                self.model_m2o.options.no_create = true;
                self.model_m2o.options.no_quick_create = true;

                self.model_m2o.prependTo(self.$(".oe_models_add_row"));
                self.$("#add_row").click(function () {
                    var id = self.model_m2o.get_value();
                    if (id === false) {
                        self.dfm.set({display_invalid_fields: true});
                        return;
                    }
                    var pricelist_id;
                    if (self.view.dataset.model === "purchase.order") {
                        // don't add models in invoices, just use them
                        pricelist_id = 1;
                    } else {
                        pricelist_id = self.field_manager.get_field_value('pricelist_id');
                    }
                    new Model(self.view.model).call("new_model_defaults",
                        [
                            self.field_manager.get_field_value('partner_id'),
                            pricelist_id,
                            self.field_manager.get_field_value('date_order'),
                            self.field_manager.get_field_value('fiscal_position_id'),
                            self.field_manager.get_field_value('state'),
                            id
                        ], {
                            'context': new data.CompoundContext({
                                'user_id': self.get('user_id')
                            })
                        }).then(function (result) {

                        var _measurebars = self.get('measurebars'); //deep copy?

                        for (var i = 0; i < _measurebars.length; i++) {
                            var bar = _measurebars[i];
                            if (bar.id == result.measurebar.id) {
                                // add model to bar
                                bar.models.push(result.measurebar.models[0]);

                                self.set('measurebars', _measurebars);

                                self.updating = true;
                                var linestext = localStorage.getItem("order_lines");
                                var lines = JSON.parse(linestext);
                                var commands = self.field_manager.get_field_value(self.common_lines_name);
                                _.each(result.order_lines, function (item) {
                                    commands.push([0, 0, item])
                                    lines.order_lines.push(item);
                                });
                                localStorage.setItem("order_lines", JSON.stringify(lines));
                                self.updating = false;
                                self.display_data();
                                return;
                            }
                        }

                        _measurebars.push(result.measurebar)
                        self.set('measurebars', _measurebars);
                        var linestext = localStorage.getItem("order_lines");
                        var lines = JSON.parse(linestext);
                        var commands = self.field_manager.get_field_value(self.common_lines_name);
                        _.each(result.order_lines, function (item) {
                            commands.push([0, 0, item])
                            lines.order_lines.push(item);
                        });
                        localStorage.setItem("order_lines", JSON.stringify(lines));
                        self.updating = true;

                        self.updating = false
                        lines[self.common_lines_name] = commands;
                        //self.field_manager.set_values(lines);

                        self.updating = false;
                        self.display_data();

                    })

                });
            },
            update_models: function () {
                var self = this;

                if (self.get("effective_readonly")) {
                    //alert("Orderlines changed in readonly mode!!");
                    return;
                }

                if (self.reload_after_save) {
                    self.reload_after_save = false;
                    self.initialize_content();
                    return;
                }

                var commands = self.field_manager.get_field_value(self.common_lines_name);
                self.execute_on_products(false, false, false, function (bar, model, product) {

                    var item_updated = false;
                    _.each(commands, function (command, index) {
                        if (command[0] == 5 || command[0] == 6) {
                            alert("Fout! alle producten werden verwijderd of vervangen, hier kan de widget maten & kleuren niet mee overweg");
                            return;
                        }

                        switch (command[0]) {
                            case 0: // new value
                                if (!product.order_line_id) {
                                    // existing item can't have a 'new' command
                                    // check if product en product template are correct and if it is a series variant
                                    var props = command[2];
                                    if (props.product_id && props.product_id == product.id && props.ad_is_model_variant) {
                                        if (self.common_quantity_name in command[2]) {
                                            product.quantity = command[2][self.common_quantity_name];
                                            this.$(".product-" + product.id).val(product.quantity);
                                        }
                                        // item_updated = true;
                                    }
                                }
                                break;
                            case 1: // update existing value
                                if (product.order_line_id && product.order_line_id == command[1]) {
                                    if (self.common_quantity_name in command[2]) {
                                        product.quantity = command[2][self.common_quantity_name];
                                        self.$(".product-" + product.id).val(product.quantity);
                                    }
                                    //item_updated = true;
                                }
                                break;
                            case 2: // remove existing value from set and database
                            case 3: // remove existing value from set but not from database
                                if (product.order_line_id && product.order_line_id == command[1]) {
                                    product.quantity = 0;
                                    self.$(".product-" + product.id).val(product.quantity);
                                    //item_updated = true;
                                }
                                break;
                            case 4: // nothing changed since last save, don't look at it
                                if (product.order_line_id && product.order_line_id == command[1]) {
                                    //item_updated = true;
                                }

                                break;
                        }
                    });

                    if (!item_updated) {
                        // item not in the commands list, delete it (set to zero)
                        product.quantity = 0;
                        self.$(".product-" + product.id).val(product.quantity);
                    }

                    return product.quantity;
                });

                // nog te doen
                // // updaten van totaal bij het klikken op 'update'

            },
            format_currency: function (amount) {
                if (typeof amount === 'number') {
                    amount = Math.round(amount * 100) / 100;
                    amount = amount.toFixed(2);
                }
                return amount;
                /*if(this.currency.position === 'after'){
                 return amount + ' ' + this.currency.symbol;
                 }else{
                 return this.currency.symbol + ' ' + amount;
                 }*/
            },

            set_read_write: function () {
                var self = this;
                if (!self.get("effective_readonly")) {
                    //product-{{ product.id }}

                    self.execute_on_products(false, false, false, function (bar, model, product) {
                        self.$(".product-" + product.id).val(product.quantity);
                        return product.quantity;
                    });
                }
            },
            initialize_field: function () {
                form_common.ReinitializeWidgetMixin.initialize_field.call(this);
                var self = this;

                /*self.on("change:measurebars", self, function(){
                 self.display_data();
                 });*/

            },
            destroy_content: function () {
                var self = this;

                this.set_read_write();
                if (this.dfm) {
                    this.dfm.destroy();
                    this.dfm = undefined;
                }

            },
            update_order_lines: function (event) {
                var self = this;
                if (event) {
                    event.preventDefault();
                }

                var state = self.field_manager.get_field_value('state');
                var commands = self.field_manager.get_field_value(self.common_lines_name);
                var partner_id = self.field_manager.get_field_value('partner_id');
                var linestext = localStorage.getItem("order_lines");
                var lines = JSON.parse(linestext);
                var has_changes = false;

                if (partner_id === false) {
                    alert("Opgelet, selecteer eerst een klant!");
                    //product.quantity = old_quantity;
                    //current_product.val(old_quantity);
                    //return product.quantity;
                } else {
                    self.execute_on_products(false, false, false, function (bar, model, product) {
                        var current_product = $(".product-" + product.id);
                        var old_quantity = product.quantity;
                        product.quantity = parseFloat(current_product.val());

                        if (old_quantity === product.quantity) {
                            return product.quantity;
                        }

                        if (isNaN(product.quantity)) {
                            alert("Opgelet, veld " + product.attribute_name + " van model " + model.name + " bevat geen geldige hoeveelheid!");
                            product.quantity = old_quantity;
                            current_product.val(old_quantity);
                            return product.quantity;
                        }

                        var item_updated = false;
                        for (var i = 0; i < commands.length; i++) {
                            var command = commands[i];
                            if (command[0] == 5 || command[0] == 6) {
                                alert("Fout! alle producten werden verwijderd of vervangen, hier kan de widget maten & kleuren niet mee overweg");
                                return;
                            }

                            switch (command[0]) {
                                case 0: // add new value
                                    if (!product.order_line_id) {
                                        // existing item can't have a 'new' command
                                        // check if product en product template are correct and if it is a series variant
                                        var props = command[2];
                                        if (props.product_id && props.product_id == product.id && props.ad_is_model_variant) {
                                            props[self.common_quantity_name] = product.quantity;
                                            commands[i][2] = props;
                                            has_changes = true;
                                            item_updated = true;
                                        }
                                    }
                                    break;
                                case 1: // update existing value
                                    if (product.order_line_id && product.order_line_id == command[1]) {
                                        var props = command[2];
                                        props[self.common_quantity_name] = product.quantity;
                                        commands[i][2] = props;
                                        has_changes = true;
                                        item_updated = true;
                                    }
                                    break;
                                case 2: // remove existing value from set and database
                                case 3: // remove existing value from set but not from database
                                    break;
                                case 4:
                                    if (product.order_line_id && product.order_line_id == command[1]) {
                                        var props = {};
                                        props[self.common_quantity_name] = product.quantity;
                                        commands[i][0] = 1;
                                        commands[i][2] = props;
                                        has_changes = true;
                                        item_updated = true;
                                    }
                                    break;
                            }
                        }
                        if (!item_updated) {

                            // var commands = self.field_manager.get_field_value(self.common_lines_name);
                            _.each(lines.order_lines, function (item) {
                                //commands.push([0, 0, item])
                                //lines.push(item);
                                if (product.id === item.product_id) {
                                    item[self.common_quantity_name] = product.quantity;
                                    item_updated = true;
                                    has_changes = true;

                                }
                            });
                            if (!item_updated) {
                                alert("A product could not be found in the order lines, this is a coding error, please contact support.");
                            }

                        }
                    });
                    if (!has_changes) {
                        return;
                    }

                    self.updating = true;
                    var orderlines = {};
                    var arrLine = [];
                    orderlines[self.common_lines_name] = commands;
                    _.each(lines["order_lines"], function (item) {
                        arrLine = [];
                        arrLine[0] = 0;
                        arrLine[1] = false;
                        arrLine[2] = item;
                        orderlines[self.common_lines_name].push(arrLine);
                    });

                    self.field_manager.set_values(orderlines);
                    self.updating = false;
                    localStorage.setItem("order_lines", JSON.stringify({order_lines: []}));
                }


            },
            delete_row: function (event) {
                var self = this;
                if (event) {
                    event.preventDefault();
                }

                var model_element = $(event.currentTarget).closest('.oe_model_row');
                var model_id = self.get_id_from_class(model_element[0], 'model-');
                var bar_element = $(model_element).closest('.oe_measurebar_table');
                var bar_id = self.get_id_from_class(bar_element[0], 'bar-');
                var toDeleteProductIds = [];

                var commands = [];

                self.execute_on_products(bar_id, model_id, false, function (bar, model, product) {
                    var current_product = $(".product-" + product.id);

                    if (self.field_manager.get_field_value('partner_id') === false) {
                        alert("Opgelet, selecteer eerst een klant!");
                        product.quantity = old_quantity;
                        current_product.val(old_quantity);
                        return;
                    }

                    _.each(self.field_manager.get_field_value(self.common_lines_name), function (command, index) {
                        if (command[0] == 5 || command[0] == 6) {
                            alert("Fout! alle producten werden verwijderd of vervangen, hier kan de widget maten & kleuren niet mee overweg");
                            return;
                        }

                        switch (command[0]) {
                            case 0: // add new value
                                if (!product.order_line_id) {
                                    // existing item can't have a 'new' command
                                    // check if product en product template are correct and if it is a series variant
                                    var props = command[2];
                                    if (props.product_id && props.product_id == product.id && props.ad_is_model_variant) {
                                        // verwijder item uit de lijst (niet toevoegen aan nieuwe lijst)
                                    } else {
                                        commands.push(command);
                                    }
                                } else {
                                    commands.push(command);
                                }
                                break;
                            case 1: // update existing value
                                if (product.order_line_id && product.order_line_id == command[1]) {
                                    commands.push([2, command[1], 0]);
                                } else {
                                    commands.push(command);
                                }
                                break;
                            case 2: // remove existing value from set and database
                            case 3: // remove existing value from set but not from database
                                commands.push(command);
                                break;
                            case 4:
                                if (product.order_line_id && product.order_line_id == command[1]) {
                                    commands.push([2, command[1], 0]);
                                } else {
                                    commands.push(command);
                                }
                                break;
                        }
                    });


                    if (model_id === model.product_template_id) {
                        toDeleteProductIds.push(product.id);
                    }


                    return product.quantity;
                });

                var linestext = localStorage.getItem("order_lines");
                var lines = JSON.parse(linestext);
                // var commands = self.field_manager.get_field_value(self.common_lines_name);
                _.each(lines.order_lines, function (item) {
                    for (var i = 0; i < toDeleteProductIds.length; i++) {
                        if (item.product_id === toDeleteProductIds[i]) {
                            lines.order_lines.splice(i, 1);

                        }
                    }

                });
                localStorage.setItem("order_lines", JSON.stringify(lines));
                self.updating = true;
                var lines = {};
                lines[self.common_lines_name] = commands;
                self.field_manager.set_values(lines);
                self.updating = false;


                var my_index = -1;
                var measurebars = self.get('measurebars');
                for (var i = 0; i < measurebars.length; i++) {
                    if (measurebars[i].id != bar_id) {
                        continue;
                    }
                    for (var j = 0; j < measurebars[i].models.length; j++) {
                        if (measurebars[i].models[j].product_template_id != model_id) {
                            continue;
                        }
                        my_index = j;
                    }
                    if (my_index != -1) {
                        measurebars[i].models.splice(my_index, 1);
                    }
                }

                model_element.remove();
                if (self.dfm) {
                    self.destroy_content();
                }

                self.$(".oe_models_add_row").show();
                self.dfm = new form_common.DefaultFieldManager(self);
                self.dfm.extend_field_desc({
                    models: {
                        relation: "product.template.model"
                    }
                });

                var currentids = [];
                var measurebars = self.get('measurebars');
                for (var i = 0; i < measurebars.length; i++) {
                    var bar = measurebars[i];
                    for (var j = 0; j < bar.models.length; j++) {
                        var model = bar.models[j];
                        currentids.push(model.product_template_id);
                    }
                }
                var FieldMany2One = core.form_widget_registry.get('many2one');
                self.model_m2o = new FieldMany2One(self.dfm, {
                    attrs: {
                        name: "models",
                        type: "many2one",
                        domain: [
                            ['id', 'not in', currentids],
                        ],
                        context: {},
                        modifiers: '{"required": true}'
                    }
                });

                self.model_m2o.options.no_create = true;
                self.model_m2o.options.no_quick_create = true;

                self.model_m2o.prependTo(self.$(".oe_models_add_row"));
            },
            get_id_from_class: function (element, class_prefix) {
                if (element == undefined) {
                    return;
                }
                var classList = element.className.split(/\s+/);
                for (var i = 0; i < classList.length; i++) {
                    if (classList[i].match("^" + class_prefix)) {
                        return parseInt(classList[i].substr(classList[i].indexOf('-') + 1));
                    }
                }
            }

        })
        ;

    widgetRegistry.add(
        'model_widget', model_widget
    );

});