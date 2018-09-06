# -*- coding: utf-8 -*-
from odoo import http

# class ProductVariantAutomatic(http.Controller):
#     @http.route('/product_variant_automatic/product_variant_automatic/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/product_variant_automatic/product_variant_automatic/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('product_variant_automatic.listing', {
#             'root': '/product_variant_automatic/product_variant_automatic',
#             'objects': http.request.env['product_variant_automatic.product_variant_automatic'].search([]),
#         })

#     @http.route('/product_variant_automatic/product_variant_automatic/objects/<model("product_variant_automatic.product_variant_automatic"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('product_variant_automatic.object', {
#             'object': obj
#         })