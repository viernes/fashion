# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import api, fields, models, _
from odoo import SUPERUSER_ID
from datetime import date, datetime


class ProductTemplate(models.Model):

    _inherit = 'product.template'

    @api.model
    def create(self, vals):
        ''' Registro de producto negados'''
        obj = self.env['product.denied']
        template = super(ProductTemplate, self).create(vals)
        if vals.get('name'):
            obj.create({'name': vals.get('name'),'date':datetime.now()})
            template.update({'active': False})
        return template


class SaleOrder(models.Model):

    _inherit = 'sale.order'

    def normalize_data(self, vals):

        if vals.get('order_line') and vals['order_line']:
            from itertools import groupby
            order_line = []
            denidg=[]
            for k, v in groupby(vals['order_line'], key=lambda i: (0, 0, {u'product_id': i[2]['product_id'],
                                                                          u'product_uom': i[2]['product_uom'],
                                                                          u'sequence': i[2]['sequence'],
                                                                          u'customer_lead': i[2]['customer_lead'],
                                                                          u'price_unit': i[2]['price_unit'],
                                                                          u'discount': i[2]['discount'],
                                                                          u'analytic_tag_ids': i[2]['analytic_tag_ids'],
                                                                          u'tax_id': i[2]['tax_id'],
                                                                          u'layout_category_id': i[2]['layout_category_id'],
                                                                          u'name': i[2]['name']})):
                if not self.env['product.template'].search([('id', '=', k[2]['product_id'])]).active:
                    pass
                else:
                    k[2].update({'product_uom_qty': sum(map(lambda i: i[2]['product_uom_qty'], v))})
                    order_line += [k]

            vals['order_line'] = order_line
        return vals

    @api.model
    def create(self, vals):
        vals =self.normalize_data(vals)
        return super(SaleOrder, self).create(vals)

    @api.multi
    def write(self, vals):
        vals =self.normalize_data(vals)
        return super(SaleOrder, self).write(vals)

class ProductDenied(models.Model):

    _name = "product.denied"

    name = fields.Char(string="Nombre")
    date = fields.Date(string="Fecha")
    partner_id =fields.Many2one('res.partner', string="Cliente")
    sale_id = fields.Many2one('sale.order',string="Cotización")

