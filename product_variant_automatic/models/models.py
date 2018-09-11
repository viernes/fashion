# -*- coding: utf-8 -*-

from odoo import models, fields, api

class product_variant_automatic(models.TransientModel):
    _name = 'product.variant.automatic'

    attribute_id = fields.Many2one('product.attribute', 'Attribute', required=True)
    data_start = fields.Char(help="Start value of the record for the sequence", required=True)
    data_end = fields.Char(help="End value of the record for the sequence", required=True)
    type =  fields.Selection([('numeric', 'Numeric'), ('alphanumeric', 'Alphanumeric')],
                                      string='Implementation', required=True, default='standard',
                                      help="Two sequence object implementations are offered: Standard "
                                           "and 'No gap'. The later is slower than the former but forbids any "
                                           "gap in the sequence (while they are possible in the former).")
    interval = fields.Integer(string='Interval', required=True, default=1,
                             help="Odoo will automatically adds some '0' on the left of the "
                                  "'Next Number' to get the required padding size.")

    prefix = fields.Char(help="Prefix value of the record for the sequence")
    suffix = fields.Char(help="Suffix value of the record for the sequence")
    padding = fields.Integer(string='Sequence Size', required=True, default=0,
                             help="Odoo will automatically adds some '0' on the left of the "
                                  "'Next Number' to get the required padding size.")

    alphanumeric_padding = fields.Char(string='Values padding', default=0,
                             help="Odoo will automatically adds some '0' on the left of the "
                                  "'Next Number' to get the required padding size.")

    def get_data(self):
        if self.type == 'alphanumeric':
            return map(lambda x: self.prefix + str(chr(x)).rjust(self.padding, self.alphanumeric_padding) + self.suffix, range(ord(self.data_start), ord(self.data_end), int(self.interval)))
        else:
            return map(lambda x: self.prefix + str(x).rjust(self.padding, self.alphanumeric_padding) + self.suffix, range(int(self.data_start), int(self.data_end), int(self.interval)))


    @api.multi
    def do_action(self):
        templates = self.env[self.context('active_model')].browse(self.context('active_ids'))
        templates.write({
            'attibute_line_ids': [(0,0, {
                'attribute_id':self.atribute_id.id,
                'values_ids':[(0,0,{
                    'name': i
                }) for i in self._get_data()]
            })]
        })
