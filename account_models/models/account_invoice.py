# -*- coding: utf-8 -*-
##############################################################################
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################
#

from odoo import models, fields, api, _
from odoo.exceptions import Warning
import openerp.addons.decimal_precision as dp

class account_invoice_line(models.Model):
    _inherit = "account.invoice.line"
    _name = "account.invoice.line"

    ad_is_model_variant = fields.Boolean()

    _defaults = {
        'ad_is_model_variant': False,
    }

    @api.model
    def move_line_get(self, invoice_id):
        res = super(account_invoice_line, self).move_line_get(invoice_id)

        result = []
        for item in res:
            if 'quantity' in item and item['quantity'] == 0:
                continue
            result.append(item)

        return result


class account_invoice(models.Model):
    _inherit = "account.invoice"
    _name = "account.invoice"

    @api.model
    def get_model_lines(self):
        measurebars = {}
        my_id = self.env.context.get('id', self.id)

        model_sequence = 0
        for line in self.invoice_line_ids.search([['ad_is_model_variant', '=', True], ['invoice_id', '=', my_id]], order='id'):
            model_attribute = line.product_id.product_tmpl_id.model_attribute
            model = line.product_id.product_tmpl_id
            product = line.product_id

            # create measurebar if necessary
            if model_attribute.id not in measurebars.keys():

                all_vals = self.env['product.attribute.value']\
                    .search([('attribute_id', '=', model_attribute.id)])

                values = []
                for val in all_vals:
                    values.append({
                        'id': val.id,
                        'name': val.name,
                    })

                values = sorted(values, key=lambda k: k['name'])
                measurebars[model_attribute.id] = {
                    'name': model_attribute.name,
                    'id': model_attribute.id,
                    'models': {},
                    'values': values,
                }

            bar = measurebars[model_attribute.id]
            # create model if necessary
            if model.id not in bar['models'].keys():

                values = []
                for val in bar['values']:
                    for variant in model.product_variant_ids:
                        for var_val in variant.attribute_value_ids:
                            if val['id'] == var_val.id:
                                #Value in variant
                                values.append({
                                    'attribute_id': val['id'],
                                    'attribute_name': val['name'],
                                    'id': variant.id,
                                    'name': variant.name,
                                    'quantity': 0,
                                    'price': 0.0,
                                })
                                break

                tmp_values = []
                for val in bar['values']:
                    val_found = False
                    for res_val in values:
                        if val['id'] == res_val['attribute_id']:
                            tmp_values.append(res_val)
                            val_found = True
                            break

                    if val_found:
                        continue

                    #value not found
                    tmp_values.append({
                        'id': False,
                        'attribute_id': val['id'],
                        'attribute_name': val['name'],
                    })

                values = tmp_values

                image = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAAAAACPAi4CAAAACXZwQWcAAABAAAAAQADq8/hgAAAEWklEQVRYw9WX6XKjRhCAef8HiySQvGt5vfZuEselOUAcEpe4GdI9MAgQOjb5k3SVyzY1801PX9OtNf9StP80QJR5miRpXtb/AFCnvmMySgmhlJn2Mal+BSBSj1NCGeNSGAMOd0/iQYCI95TAXnm+FCr/I2ZYPwJILEJhPaGm7flBFIW+Z5sUvwEivguovG7pMR0cV2e+BbYArF3cBqQclKfEvryvSB2KaHa6BYhgDSP7ZN7gmUNQCf86wCdgcBaKq04/cTzAuwbA/czKb8VdZYMSI8IAEOJ+XjTiFkF4SDjOARIIHLiBK+4E/xHOIdEloMSAAwZx7hEOBKIquwA4lFPbR/3uEhzCqSUmgBiwrGgeIlQm5b0zO0CN3yKw34QgQC4JKZqrGAFC0MpWvuwJ3V6hWD3BI5wchoDaBAumzYQgmsrd7ewZx5bosHIAAAtQp4+nXUuA+2yXy9Xyi4OsIorjauBLZQWtd0Gqrt3EvCXQlb4BMZYfsPP7cr0gvS4FaNw6Qus0ovtez8DZcYyHt8Wmk9XWdF+Mjf570Ke4q46UgAgUCtX55mKl/wSbsD83hrEE0VGJ1RrEWHz2aaXuIAEe7b3SNG/601oSzL/W20/T2r2uDNACARvjWelZQTTaCiCg2vSR1bzrsFgSQMk8SbPi8FWX+0GFbX2OXMarDoAmOGfo+wpXt7cwj4Hv+1n+rSMYW3HOfS4TAgHZIDIVYG38wNzchyB+kj4ZUwB4npw6ABokmgA2qz9kfbIkoWDLzQSQ0tbw2gA20kA/nmyqCHG8nmqQd2prbSKQZAIwnk5B5PSE/EWfACCUZGFSgHQKeE6DsCcExfc5wKEDRLMaJHBwTwA/zFzhOLBBPGODoCfEyYUb0XVBB1AGHXvho/SVDsSjF15QrtMG1xlpsDbCrCewj7UxAWAJSjsAlJOuHI0AX9Mi8IMgsJnMC2MMOJA2f7RhXI8AG/2LVxZZVlQWmKElnAFiT5nMH62L67Mb3lTmbIzVK3Uc9r6GvJAEyMa6d0KXP1oXliqbRPPzN0NvBcrBAmSpr37wlrB8GeRS6zkJECZVNRKeuLfty1C+wc/zp7TD9jVQN7DUDq2vkUEzfAymIl9uZ5iL1B0U1Rw7surmc4SE/sUBE3KaDB8Wd1QS7hJQga4Kayow2aAsXiV0L458HE/jx9UbPi33CIf+ITwDSnxM/IcIcAGIrHzaH+BX8Ky4awdq41nBZYsjG4/kEQLjg9Q5A9A1jJ7u3CJEa1OzmuvSKgubwPA24IT7WT7fJ5YmEtwbASWO2AkP94871WpPOCc8vmYHaORhv5lf75VrV3bD+9nZIrUJamhXN9v9kMlu3wonYVlGe9msU1/cGTgKpx0YmO2fsrKq66rMk8Bh7dd99sDIk+xxxsE5icqhqfsLflkz1pkbukSCBzI5bqG0EGrPGvfK2FeGDseRi1I5eVFuB8WvDp51FvsH13Fcz4+y6n86Oz8kfwPMD02INEiadQAAAABJRU5ErkJggg=="

                if self.id and model.image_small:
                    image = model.image_small.replace('\n', '')

                bar['models'][model.id] = {
                    'model_sequence': model_sequence,
                    'name': model.name,
                    'attribute': {
                        'id': model.model_attribute.id,
                        'name': model.model_attribute.name,
                    },
                    'products': values,
                    'taxes': ', '.join(map(lambda x: x.name, line.invoice_line_tax_ids)),
                    'total_quantity': 0.0,
                    'total_price': 0.0,
                    'image': image,
                    'product_template_id': model.id,
                    'sale_order_id': self.id,
                    'origin': line.origin,
                }
                model_sequence += 1

            bar_model = bar['models'][model.id]
            for prod in bar_model['products']:
                if prod['id'] == product.id:
                    prod['quantity'] = line.quantity
                    prod['price'] = line.price_subtotal
                    prod['order_line_id'] = line.id
                    prod['price_unit'] = line.price_unit
                    prod['discount'] = line.discount

        # remove dicts
        measurebars = measurebars.values()
        for bar in measurebars:
            bar['models'] = sorted(bar['models'].values(), key=lambda x: x['model_sequence'])
            for model in bar['models']:
                price_total = 0.0
                quantity_total = 0
                has_price = False
                unit_price = 0
                has_discount = False
                discount = 0
                for prod in model['products']:
                    price_total += prod.get('price', 0.0)
                    quantity_total += prod.get('quantity', 0.0)
                    if not has_price and prod.get('price_unit', False):
                        unit_price = prod.get('price_unit', 0.0)
                        has_price = True
                    else:
                        if prod.get('price_unit', False):
                            if unit_price != prod['price_unit']:
                                raise Warning(_("Unit price for every product in a model selection should be equal"))
                    if not has_discount and prod.get('discount', False):
                        discount = prod.get('discount', 0.0)
                        has_discount = True
                    else:
                        if prod.get('discount', False):
                            if discount != prod['discount']:
                                raise Warning(_("Discount for every product in a model selection should be equal"))
                model['price_unit'] = unit_price
                model['discount'] = discount

                model['total_quantity'] = quantity_total
                model['total_price'] = price_total

        return measurebars
